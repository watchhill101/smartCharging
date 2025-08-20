import mongoose from 'mongoose';
import Wallet, { IInvoice, IInvoiceInfo } from '../models/Wallet';
import User from '../models/User';
import Order from '../models/Order';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

export interface InvoiceGenerationParams {
  userId: string;
  transactionIds: string[];
  invoiceType: 'electronic' | 'paper';
  invoiceInfoId?: string;
}

export interface InvoiceDownloadInfo {
  invoiceId: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
}

export interface InvoiceEmailParams {
  invoiceId: string;
  recipientEmail: string;
  subject?: string;
  message?: string;
}

export interface InvoiceQueryParams {
  userId: string;
  status?: 'pending' | 'issued' | 'sent' | 'cancelled';
  type?: 'electronic' | 'paper';
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface InvoiceStatistics {
  totalInvoices: number;
  totalAmount: number;
  electronicCount: number;
  paperCount: number;
  statusCounts: {
    pending: number;
    issued: number;
    sent: number;
    cancelled: number;
  };
  monthlyStats: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
}

export class InvoiceService {
  private static emailTransporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  /**
   * 创建发票申请
   */
  static async createInvoiceApplication(params: InvoiceGenerationParams): Promise<{
    success: boolean;
    message?: string;
    invoiceId?: string;
    invoice?: IInvoice;
  }> {
    const { userId, transactionIds, invoiceType, invoiceInfoId } = params;

    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return { success: false, message: '钱包不存在' };
      }

      // 验证交易记录
      const validTransactions = wallet.transactions.filter(t => 
        transactionIds.includes(t.id) && 
        t.status === 'completed' && 
        (t.type === 'recharge' || t.type === 'consume')
      );

      if (validTransactions.length === 0) {
        return { success: false, message: '没有找到有效的交易记录' };
      }

      // 检查交易是否已开票
      const alreadyInvoiced = wallet.invoices.some(invoice => 
        invoice.transactionIds.some(id => transactionIds.includes(id)) &&
        invoice.status !== 'cancelled'
      );

      if (alreadyInvoiced) {
        return { success: false, message: '部分交易记录已开票，请重新选择' };
      }

      // 获取发票信息
      let invoiceInfo;
      if (invoiceInfoId) {
        invoiceInfo = wallet.invoiceInfo.find(info => info.type === invoiceInfoId);
      } else {
        invoiceInfo = wallet.invoiceInfo.find(info => info.isDefault);
      }

      if (!invoiceInfo) {
        return { success: false, message: '请先设置发票信息' };
      }

      // 计算发票金额
      const totalAmount = validTransactions.reduce((sum, t) => sum + t.amount, 0);

      // 创建发票记录
      const invoice = wallet.createInvoice({
        amount: totalAmount,
        title: invoiceInfo.title,
        taxNumber: invoiceInfo.taxNumber,
        content: this.generateInvoiceContent(validTransactions),
        type: invoiceType,
        status: 'pending',
        transactionIds
      });

      await wallet.save();

      return {
        success: true,
        message: '发票申请创建成功',
        invoiceId: invoice.id,
        invoice
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '创建发票申请失败'
      };
    }
  }

  /**
   * 生成发票内容描述
   */
  private static generateInvoiceContent(transactions: any[]): string {
    const rechargeTransactions = transactions.filter(t => t.type === 'recharge');
    const consumeTransactions = transactions.filter(t => t.type === 'consume');

    const contents = [];
    if (rechargeTransactions.length > 0) {
      contents.push(`充电服务充值 ${rechargeTransactions.length}笔`);
    }
    if (consumeTransactions.length > 0) {
      contents.push(`充电服务费 ${consumeTransactions.length}笔`);
    }

    return contents.join('，') || '充电服务费';
  }

  /**
   * 处理发票（模拟发票生成）
   */
  static async processInvoice(invoiceId: string): Promise<{
    success: boolean;
    message?: string;
    downloadUrl?: string;
  }> {
    try {
      const wallet = await Wallet.findOne({ 'invoices.id': invoiceId });
      if (!wallet) {
        return { success: false, message: '发票不存在' };
      }

      const invoice = wallet.invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        return { success: false, message: '发票不存在' };
      }

      if (invoice.status !== 'pending') {
        return { success: false, message: '发票状态不允许处理' };
      }

      // 模拟发票生成过程
      const fileName = `invoice_${invoice.invoiceNumber}.pdf`;
      const filePath = path.join(process.cwd(), 'uploads', 'invoices', fileName);
      
      // 确保目录存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 生成模拟PDF文件
      await this.generateInvoicePDF(invoice, filePath);

      // 更新发票状态
      invoice.status = 'issued';
      invoice.issuedAt = new Date();
      invoice.downloadUrl = `/api/invoices/download/${fileName}`;
      invoice.updatedAt = new Date();

      await wallet.save();

      return {
        success: true,
        message: '发票生成成功',
        downloadUrl: invoice.downloadUrl
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '发票处理失败'
      };
    }
  }

  /**
   * 生成发票PDF（模拟实现）
   */
  private static async generateInvoicePDF(invoice: IInvoice, filePath: string): Promise<void> {
    // 这里是模拟实现，实际项目中应该使用PDF生成库如puppeteer、jsPDF等
    const invoiceContent = `
发票信息
========
发票号码: ${invoice.invoiceNumber}
开票日期: ${new Date().toLocaleDateString('zh-CN')}
发票抬头: ${invoice.title}
税号: ${invoice.taxNumber || '无'}
发票内容: ${invoice.content}
发票金额: ¥${invoice.amount.toFixed(2)}
发票类型: ${invoice.type === 'electronic' ? '电子发票' : '纸质发票'}

交易明细
========
交易ID: ${invoice.transactionIds.join(', ')}

备注: 本发票为智能充电系统自动生成
    `;

    // 写入模拟PDF内容
    fs.writeFileSync(filePath, invoiceContent, 'utf8');
  }

  /**
   * 发送发票邮件
   */
  static async sendInvoiceEmail(params: InvoiceEmailParams): Promise<{
    success: boolean;
    message?: string;
  }> {
    const { invoiceId, recipientEmail, subject, message } = params;

    try {
      const wallet = await Wallet.findOne({ 'invoices.id': invoiceId });
      if (!wallet) {
        return { success: false, message: '发票不存在' };
      }

      const invoice = wallet.invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        return { success: false, message: '发票不存在' };
      }

      if (invoice.status !== 'issued') {
        return { success: false, message: '发票尚未生成，无法发送' };
      }

      if (!invoice.downloadUrl) {
        return { success: false, message: '发票文件不存在' };
      }

      // 获取发票文件路径
      const fileName = path.basename(invoice.downloadUrl);
      const filePath = path.join(process.cwd(), 'uploads', 'invoices', fileName);

      if (!fs.existsSync(filePath)) {
        return { success: false, message: '发票文件不存在' };
      }

      // 发送邮件
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: recipientEmail,
        subject: subject || `智能充电系统发票 - ${invoice.invoiceNumber}`,
        html: `
          <h2>智能充电系统发票</h2>
          <p>尊敬的用户，您好！</p>
          <p>您申请的发票已生成完成，请查收附件。</p>
          <p><strong>发票信息：</strong></p>
          <ul>
            <li>发票号码：${invoice.invoiceNumber}</li>
            <li>发票抬头：${invoice.title}</li>
            <li>发票金额：¥${invoice.amount.toFixed(2)}</li>
            <li>开票日期：${invoice.issuedAt?.toLocaleDateString('zh-CN')}</li>
          </ul>
          <p>${message || '感谢您使用智能充电系统！'}</p>
          <p>如有疑问，请联系客服。</p>
        `,
        attachments: [
          {
            filename: fileName,
            path: filePath
          }
        ]
      };

      await this.emailTransporter.sendMail(mailOptions);

      // 更新发票状态
      invoice.status = 'sent';
      invoice.updatedAt = new Date();
      await wallet.save();

      return {
        success: true,
        message: '发票邮件发送成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '发票邮件发送失败'
      };
    }
  }

  /**
   * 获取发票列表
   */
  static async getInvoiceList(params: InvoiceQueryParams) {
    const { userId, status, type, startDate, endDate, page = 1, limit = 20 } = params;

    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return {
          invoices: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        };
      }

      let invoices = wallet.invoices;

      // 筛选条件
      if (status) {
        invoices = invoices.filter(inv => inv.status === status);
      }
      if (type) {
        invoices = invoices.filter(inv => inv.type === type);
      }
      if (startDate) {
        invoices = invoices.filter(inv => new Date(inv.createdAt) >= startDate);
      }
      if (endDate) {
        invoices = invoices.filter(inv => new Date(inv.createdAt) <= endDate);
      }

      // 排序
      invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 分页
      const total = invoices.length;
      const startIndex = (page - 1) * limit;
      const paginatedInvoices = invoices.slice(startIndex, startIndex + limit);

      return {
        invoices: paginatedInvoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取发票列表失败');
    }
  }

  /**
   * 获取发票详情
   */
  static async getInvoiceDetail(userId: string, invoiceId: string): Promise<IInvoice | null> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return null;
      }

      return wallet.invoices.find(inv => inv.id === invoiceId) || null;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取发票详情失败');
    }
  }

  /**
   * 取消发票
   */
  static async cancelInvoice(userId: string, invoiceId: string, reason?: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return { success: false, message: '钱包不存在' };
      }

      const invoice = wallet.invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        return { success: false, message: '发票不存在' };
      }

      if (invoice.status === 'cancelled') {
        return { success: false, message: '发票已取消' };
      }

      if (invoice.status === 'sent') {
        return { success: false, message: '已发送的发票无法取消' };
      }

      // 取消发票
      invoice.status = 'cancelled';
      invoice.updatedAt = new Date();

      await wallet.save();

      return {
        success: true,
        message: '发票取消成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '取消发票失败'
      };
    }
  }

  /**
   * 获取发票统计信息
   */
  static async getInvoiceStatistics(userId: string, year?: number): Promise<InvoiceStatistics | null> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return null;
      }

      const currentYear = year || new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear + 1, 0, 1);

      // 筛选当年发票
      const yearInvoices = wallet.invoices.filter(inv => {
        const invoiceDate = new Date(inv.createdAt);
        return invoiceDate >= yearStart && invoiceDate < yearEnd;
      });

      // 基础统计
      const totalInvoices = yearInvoices.length;
      const totalAmount = yearInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      const electronicCount = yearInvoices.filter(inv => inv.type === 'electronic').length;
      const paperCount = yearInvoices.filter(inv => inv.type === 'paper').length;

      // 状态统计
      const statusCounts = {
        pending: yearInvoices.filter(inv => inv.status === 'pending').length,
        issued: yearInvoices.filter(inv => inv.status === 'issued').length,
        sent: yearInvoices.filter(inv => inv.status === 'sent').length,
        cancelled: yearInvoices.filter(inv => inv.status === 'cancelled').length
      };

      // 月度统计
      const monthlyStats = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 1);
        
        const monthInvoices = yearInvoices.filter(inv => {
          const invoiceDate = new Date(inv.createdAt);
          return invoiceDate >= monthStart && invoiceDate < monthEnd;
        });

        monthlyStats.push({
          month: `${currentYear}-${(month + 1).toString().padStart(2, '0')}`,
          count: monthInvoices.length,
          amount: monthInvoices.reduce((sum, inv) => sum + inv.amount, 0)
        });
      }

      return {
        totalInvoices,
        totalAmount,
        electronicCount,
        paperCount,
        statusCounts,
        monthlyStats
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取发票统计失败');
    }
  }

  /**
   * 批量处理发票
   */
  static async batchProcessInvoices(invoiceIds: string[]): Promise<{
    success: boolean;
    message?: string;
    results?: Array<{ invoiceId: string; success: boolean; message?: string }>;
  }> {
    try {
      const results = [];

      for (const invoiceId of invoiceIds) {
        const result = await this.processInvoice(invoiceId);
        results.push({
          invoiceId,
          success: result.success,
          message: result.message
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      return {
        success: true,
        message: `批量处理完成：成功 ${successCount} 个，失败 ${failCount} 个`,
        results
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '批量处理发票失败'
      };
    }
  }

  /**
   * 获取发票下载信息
   */
  static async getInvoiceDownloadInfo(userId: string, invoiceId: string): Promise<InvoiceDownloadInfo | null> {
    try {
      const invoice = await this.getInvoiceDetail(userId, invoiceId);
      if (!invoice || !invoice.downloadUrl) {
        return null;
      }

      const fileName = path.basename(invoice.downloadUrl);
      const filePath = path.join(process.cwd(), 'uploads', 'invoices', fileName);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      return {
        invoiceId: invoice.id,
        fileName,
        filePath,
        downloadUrl: invoice.downloadUrl
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取发票下载信息失败');
    }
  }

  /**
   * 验证发票信息完整性
   */
  static validateInvoiceInfo(invoiceInfo: Partial<IInvoiceInfo>): { valid: boolean; message?: string } {
    if (!invoiceInfo.title || invoiceInfo.title.trim().length === 0) {
      return { valid: false, message: '发票抬头不能为空' };
    }

    if (invoiceInfo.type === 'company' && !invoiceInfo.taxNumber) {
      return { valid: false, message: '企业发票必须提供税号' };
    }

    if (!invoiceInfo.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceInfo.email)) {
      return { valid: false, message: '邮箱格式不正确' };
    }

    return { valid: true };
  }

  /**
   * 清理过期的待处理发票
   */
  static async cleanupExpiredInvoices(expireDays = 30): Promise<{
    success: boolean;
    message?: string;
    cleanedCount?: number;
  }> {
    try {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() - expireDays);

      const wallets = await Wallet.find({
        'invoices.status': 'pending',
        'invoices.createdAt': { $lt: expireDate }
      });

      let cleanedCount = 0;

      for (const wallet of wallets) {
        let hasChanges = false;
        
        wallet.invoices.forEach(invoice => {
          if (invoice.status === 'pending' && new Date(invoice.createdAt) < expireDate) {
            invoice.status = 'cancelled';
            invoice.updatedAt = new Date();
            hasChanges = true;
            cleanedCount++;
          }
        });

        if (hasChanges) {
          await wallet.save();
        }
      }

      return {
        success: true,
        message: `清理完成，共处理 ${cleanedCount} 个过期发票`,
        cleanedCount
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '清理过期发票失败'
      };
    }
  }
}