"""
OCPP充电服务主入口
实现OCPP 1.6J协议的充电桩通信服务
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional
import json

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ocpp_service import OCPPService
from charging_session import ChargingSessionManager
from pile_manager import ChargingPileManager
from models import ChargingPile, ChargingSession, OCPPMessage
from config import settings
from ocpp_monitoring import router as monitoring_router, monitoring_service
from ocpp_error_handler import error_handler
from enhanced_connection_manager import enhanced_manager, start_connection_manager, stop_connection_manager
from websocket_optimizer import MessagePriority

# 导入增强日志系统
from enhanced_logging import (
    get_logger, configure_logging, LogContext, LogLevel,
    log_manager, info, error, warning, debug, context, timer
)

# 配置增强日志系统
configure_logging(
    level=LogLevel.INFO,
    enable_console=True,
    enable_file=True,
    enable_structured=True,
    enable_performance_tracking=True,
    log_dir='logs',
    max_file_size=20 * 1024 * 1024,  # 20MB
    backup_count=15,
    enable_error_tracking=True,
    enable_metrics=True
)

# 获取增强日志器
logger = get_logger('charging_service_main')

# 保持向后兼容的日志记录
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('charging_service.log'),
        logging.StreamHandler()
    ]
)

# 创建FastAPI应用
app = FastAPI(
    title="智能充电OCPP服务",
    description="基于OCPP 1.6J协议的充电桩通信服务",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册监控路由
app.include_router(monitoring_router)

# 全局服务实例
ocpp_service = OCPPService()
session_manager = ChargingSessionManager()
pile_manager = ChargingPileManager()

# WebSocket连接管理 - 使用增强连接管理器
class ConnectionManager:
    """WebSocket连接管理器 - 兼容性包装器"""
    
    def __init__(self):
        self.manager = enhanced_manager
        logger.info("使用增强连接管理器")
    
    async def connect(self, websocket: WebSocket, pile_id: str):
        """接受WebSocket连接 - 兼容性方法"""
        await websocket.accept()
        await self.manager.optimizer.add_connection(websocket, pile_id)
        logger.info(f"充电桩 {pile_id} 连接成功")
    
    def disconnect(self, pile_id: str):
        """断开连接 - 兼容性方法"""
        # 注意：这是同步方法，实际断开会在WebSocket关闭时自动处理
        logger.info(f"充电桩 {pile_id} 连接断开")
    
    async def send_message(self, pile_id: str, message: dict):
        """发送消息到指定充电桩 - 兼容性方法"""
        success = await self.manager.send_message_to_pile(pile_id, message, MessagePriority.NORMAL)
        if not success:
            connection_error = Exception(f"充电桩 {pile_id} 未连接")
            await error_handler.handle_connection_error(pile_id, connection_error)
            raise connection_error
    
    async def broadcast(self, message: dict):
        """广播消息到所有连接的充电桩 - 兼容性方法"""
        failed_connections = []
        stats = await self.manager.get_connection_stats()
        
        for pile_id in stats.pile_connections.keys():
            try:
                success = await self.manager.broadcast_to_pile(pile_id, message, MessagePriority.NORMAL)
                if success == 0:
                    failed_connections.append(pile_id)
            except Exception as e:
                logger.error(f"广播消息到充电桩 {pile_id} 失败: {e}")
                failed_connections.append(pile_id)
                
                # 记录广播失败统计
                monitoring_service.record_message("broadcast", False)
                
                # 处理连接错误
                await error_handler.handle_connection_error(pile_id, e)
        
        logger.info(f"广播消息完成，失败连接数: {len(failed_connections)}")

manager = ConnectionManager()

# API模型
class StartChargingRequest(BaseModel):
    pile_id: str
    user_id: str
    connector_id: int = 1
    id_tag: str
    
class StopChargingRequest(BaseModel):
    pile_id: str
    session_id: str
    reason: str = "Local"

class ChargingStatusResponse(BaseModel):
    pile_id: str
    status: str
    session_id: Optional[str] = None
    current_power: Optional[float] = None
    energy_delivered: Optional[float] = None
    duration: Optional[int] = None
    cost: Optional[float] = None

# WebSocket端点 - 充电桩连接
@app.websocket("/ws/pile/{pile_id}")
async def websocket_endpoint(websocket: WebSocket, pile_id: str):
    """充电桩WebSocket连接端点 - 使用增强连接管理器"""
    connection_context = LogContext(
        pile_id=pile_id,
        operation="websocket_connection",
        component="websocket"
    )
    
    with context(**connection_context.to_dict()):
        async with enhanced_manager.connect_pile(websocket, pile_id) as connection_id:
            connection_start_time = datetime.now()
            message_count = 0
            
            try:
                info("充电桩连接建立", metadata={
                    "pile_id": pile_id,
                    "connection_id": connection_id,
                    "client_host": websocket.client.host if websocket.client else "unknown"
                })
                
                # 注册充电桩
                with timer("register_pile", "充电桩注册完成"):
                    await pile_manager.register_pile(pile_id, websocket)
                
                # 发送BootNotification
                with timer("boot_notification", "BootNotification发送完成"):
                    boot_notification = await ocpp_service.handle_boot_notification(pile_id)
                    await enhanced_manager.send_message_to_pile(pile_id, boot_notification, MessagePriority.HIGH)
                
                while True:
                    # 接收充电桩消息
                    with timer("receive_message"):
                        data = await enhanced_manager.receive_message(websocket, pile_id)
                    
                    if data is None:  # 连接断开或接收失败
                        break
                    
                    message_count += 1
                    message_context = LogContext(
                        pile_id=pile_id,
                        operation="handle_message",
                        component="websocket"
                    )
                    
                    with context(**message_context.to_dict()):
                        debug("收到充电桩消息", metadata={
                            "message_length": len(str(data)),
                            "message_preview": str(data)[:100] + "..." if len(str(data)) > 100 else str(data),
                            "message_count": message_count
                        })
                        
                        start_time = datetime.now()
                        
                        try:
                            # 处理OCPP消息
                            with timer("process_ocpp_message", "OCPP消息处理完成"):
                                response = await ocpp_service.handle_message(pile_id, data)
                            
                            # 记录处理成功统计
                            response_time = (datetime.now() - start_time).total_seconds()
                            
                            # 获取操作类型
                            action = data.get('action', 'unknown') if isinstance(data, dict) else 'unknown'
                            monitoring_service.record_message(action, True, response_time)
                            
                            if response:
                                with timer("send_response"):
                                    await enhanced_manager.send_message_to_pile(pile_id, response, MessagePriority.NORMAL)
                                
                                debug("发送响应", metadata={
                                    "response_length": len(str(response)),
                                    "response_preview": str(response)[:100] + "..." if len(str(response)) > 100 else str(response)
                                })
                                
                        except Exception as e:
                            # 记录处理失败统计
                            response_time = (datetime.now() - start_time).total_seconds()
                            action = data.get('action', 'unknown') if isinstance(data, dict) else 'unknown'
                            monitoring_service.record_message(action, False, response_time)
                            
                            error("处理充电桩消息失败", error=e, metadata={
                                "message_count": message_count,
                                "error_type": type(e).__name__,
                                "action": action
                            })
                            
                            # 使用错误处理器处理错误
                            error_response = await error_handler.handle_ocpp_error(pile_id, data, e)
                            if error_response:
                                await enhanced_manager.send_message_to_pile(pile_id, error_response, MessagePriority.HIGH)
                                
            except WebSocketDisconnect:
                connection_duration = (datetime.now() - connection_start_time).total_seconds()
                info("充电桩连接正常断开", metadata={
                    "connection_duration": connection_duration,
                    "total_messages": message_count,
                    "avg_messages_per_second": message_count / connection_duration if connection_duration > 0 else 0
                })
            except Exception as e:
                connection_duration = (datetime.now() - connection_start_time).total_seconds()
                error("WebSocket连接错误", error=e, metadata={
                    "connection_duration": connection_duration,
                    "total_messages": message_count,
                    "error_type": type(e).__name__
                })
            finally:
                try:
                    with timer("unregister_pile", "充电桩注销完成"):
                        await pile_manager.unregister_pile(pile_id)
                    
                    final_duration = (datetime.now() - connection_start_time).total_seconds()
                    info("充电桩连接处理结束", metadata={
                        "total_connection_duration": final_duration,
                        "total_messages_processed": message_count,
                        "cleanup_successful": True
                    })
                except Exception as cleanup_error:
                    error("连接清理失败", error=cleanup_error, metadata={
                        "cleanup_error_type": type(cleanup_error).__name__
                    })

# WebSocket端点 - 客户端连接
@app.websocket("/ws/client/{client_id}")
async def client_websocket_endpoint(websocket: WebSocket, client_id: str):
    """客户端WebSocket连接端点"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"收到客户端 {client_id} 消息: {data}")
            
            start_time = datetime.now()
            
            try:
                # 处理客户端消息
                if data.get("type") == "subscribe_pile":
                    pile_id = data.get("pile_id")
                    # 订阅充电桩状态更新
                    await session_manager.subscribe_pile_status(client_id, pile_id, websocket)
                    
                    # 记录成功统计
                    response_time = (datetime.now() - start_time).total_seconds()
                    monitoring_service.record_message("client_subscribe", True, response_time)
                    
            except Exception as e:
                # 记录失败统计
                response_time = (datetime.now() - start_time).total_seconds()
                monitoring_service.record_message("client_message", False, response_time)
                
                logger.error(f"处理客户端 {client_id} 消息失败: {e}")
                
                # 发送错误响应给客户端
                error_response = {
                    "type": "error",
                    "message": f"处理消息失败: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                }
                await websocket.send_json(error_response)
                
    except WebSocketDisconnect:
        logger.info(f"客户端 {client_id} 断开连接")
    except Exception as e:
        logger.error(f"客户端WebSocket连接错误: {e}")

# REST API端点

@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "service": "OCPP充电服务",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/piles")
async def get_piles():
    """获取所有充电桩列表"""
    piles = await pile_manager.get_all_piles()
    return {
        "success": True,
        "data": piles,
        "total": len(piles)
    }

@app.get("/piles/{pile_id}")
async def get_pile_info(pile_id: str):
    """获取指定充电桩信息"""
    pile = await pile_manager.get_pile(pile_id)
    if not pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    return {
        "success": True,
        "data": pile
    }

@app.get("/piles/{pile_id}/status")
async def get_pile_status(pile_id: str):
    """获取充电桩状态"""
    status = await pile_manager.get_pile_status(pile_id)
    if not status:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    return {
        "success": True,
        "data": status
    }

@app.post("/charging/start")
async def start_charging(request: StartChargingRequest):
    """开始充电"""
    try:
        # 输入验证
        if not request.pile_id or not request.pile_id.strip():
            raise HTTPException(status_code=400, detail="充电桩ID不能为空")
        
        if not request.id_tag or not request.id_tag.strip():
            raise HTTPException(status_code=400, detail="用户标识不能为空")
        
        if request.connector_id < 1:
            raise HTTPException(status_code=400, detail="连接器ID无效")
        
        # 用户授权验证
        if not await ocpp_service.authorize_user(request.id_tag):
            raise HTTPException(status_code=403, detail="用户未授权")
        
        # 检查充电桩是否可用
        pile = await pile_manager.get_pile(request.pile_id)
        if not pile:
            raise HTTPException(status_code=404, detail="充电桩不存在")
        
        if pile.status != "Available":
            raise HTTPException(status_code=400, detail="充电桩当前不可用")
        
        # 发送RemoteStartTransaction
        result = await ocpp_service.remote_start_transaction(
            request.pile_id,
            request.id_tag,
            request.connector_id
        )
        
        if result.get("status") == "Accepted":
            # 创建充电会话
            session = await session_manager.create_session(
                pile_id=request.pile_id,
                user_id=request.user_id,
                connector_id=request.connector_id,
                id_tag=request.id_tag
            )
            
            return {
                "success": True,
                "data": {
                    "session_id": session.session_id,
                    "pile_id": request.pile_id,
                    "status": "Starting"
                },
                "message": "充电启动成功"
            }
        else:
            raise HTTPException(status_code=400, detail="充电启动失败")
            
    except Exception as e:
        logger.error(f"启动充电失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/charging/stop")
async def stop_charging(request: StopChargingRequest):
    """停止充电"""
    try:
        # 获取充电会话
        session = await session_manager.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="充电会话不存在")
        
        # 发送RemoteStopTransaction
        result = await ocpp_service.remote_stop_transaction(
            request.pile_id,
            session.transaction_id
        )
        
        if result.get("status") == "Accepted":
            # 结束充电会话
            await session_manager.end_session(request.session_id, request.reason)
            
            return {
                "success": True,
                "data": {
                    "session_id": request.session_id,
                    "pile_id": request.pile_id,
                    "status": "Stopping"
                },
                "message": "充电停止成功"
            }
        else:
            raise HTTPException(status_code=400, detail="充电停止失败")
            
    except Exception as e:
        logger.error(f"停止充电失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/charging/sessions")
async def get_charging_sessions(
    pile_id: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """获取充电会话列表"""
    sessions = await session_manager.get_sessions(
        pile_id=pile_id,
        user_id=user_id,
        status=status,
        limit=limit,
        offset=offset
    )
    
    return {
        "success": True,
        "data": sessions,
        "total": len(sessions)
    }

@app.get("/charging/sessions/{session_id}")
async def get_charging_session(session_id: str):
    """获取指定充电会话详情"""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="充电会话不存在")
    
    return {
        "success": True,
        "data": session
    }

@app.get("/charging/sessions/{session_id}/status")
async def get_charging_session_status(session_id: str) -> ChargingStatusResponse:
    """获取充电会话实时状态"""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="充电会话不存在")
    
    # 获取实时状态
    status = await session_manager.get_session_status(session_id)
    
    return ChargingStatusResponse(
        pile_id=session.pile_id,
        status=session.status,
        session_id=session_id,
        current_power=status.get("current_power"),
        energy_delivered=status.get("energy_delivered"),
        duration=status.get("duration"),
        cost=status.get("cost")
    )

@app.post("/piles/{pile_id}/reset")
async def reset_pile(pile_id: str, reset_type: str = "Soft"):
    """重置充电桩"""
    try:
        result = await ocpp_service.reset_pile(pile_id, reset_type)
        
        return {
            "success": True,
            "data": result,
            "message": f"充电桩重置命令已发送"
        }
        
    except Exception as e:
        logger.error(f"重置充电桩失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/piles/{pile_id}/unlock")
async def unlock_connector(pile_id: str, connector_id: int = 1):
    """解锁充电枪"""
    try:
        result = await ocpp_service.unlock_connector(pile_id, connector_id)
        
        return {
            "success": True,
            "data": result,
            "message": "充电枪解锁命令已发送"
        }
        
    except Exception as e:
        logger.error(f"解锁充电枪失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/statistics")
async def get_statistics():
    """获取服务统计信息"""
    stats = {
        "connected_piles": len(manager.active_connections),
        "active_sessions": await session_manager.get_active_session_count(),
        "total_energy_delivered": await session_manager.get_total_energy_delivered(),
        "uptime": datetime.now().isoformat()
    }
    
    return {
        "success": True,
        "data": stats
    }

@app.get("/api/stats")
async def get_stats():
    """获取服务统计信息"""
    request_context = LogContext(
        operation="get_stats",
        component="api"
    )
    
    with context(**request_context.to_dict()):
        with timer("get_stats_operation", "获取统计信息完成"):
            try:
                info("开始获取服务统计信息")
                
                # 获取监控统计
                monitoring_stats = await monitoring_service.get_stats()
                
                # 获取错误处理统计
                error_stats = await error_handler.get_stats()
                
                # 获取增强连接管理器统计
                connection_stats = await enhanced_manager.get_connection_stats()
                
                # 获取日志系统指标
                log_metrics = log_manager.get_all_metrics()
                
                result = {
                    "status": "success",
                    "timestamp": datetime.now().isoformat(),
                    "monitoring": monitoring_stats,
                    "error_handling": error_stats,
                    "connections": connection_stats.dict(),
                    "logging": log_metrics
                }
                
                info("统计信息获取成功", metadata={
                    "stats_count": len(result),
                    "active_connections": connection_stats.total_connections
                })
                
                return result
                
            except Exception as e:
                error("获取统计信息失败", error=e, metadata={
                    "error_type": type(e).__name__
                })
                raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """系统健康检查"""
    request_context = LogContext(
        operation="health_check",
        component="api"
    )
    
    with context(**request_context.to_dict()):
        with timer("health_check_operation", "健康检查完成"):
            try:
                debug("开始系统健康检查")
                
                # 获取增强连接管理器健康状态
                health_info = await enhanced_manager.health_check()
                
                # 获取日志系统健康状态
                log_health = log_manager.health_check()
                
                # 集成日志系统健康状态
                health_info["components"]["logging_system"] = log_health["status"]
                health_info["details"] = health_info.get("details", {})
                health_info["details"]["logging"] = log_health
                
                # 检查日志系统状态
                if log_health["status"] != "healthy":
                    if health_info["status"] == "healthy":
                        health_info["status"] = "degraded"
                    warning("日志系统状态降级", metadata={
                        "issues": log_health["issues"]
                    })
                
                # 根据健康状态设置HTTP状态码
                status_code = 200
                if health_info["status"] == "unhealthy":
                    status_code = 503
                elif health_info["status"] == "degraded":
                    status_code = 206
                
                info("健康检查完成", metadata={
                    "overall_status": health_info["status"],
                    "component_count": len(health_info.get("components", {})),
                    "status_code": status_code,
                    "health_score": health_info.get("health_score", 0)
                })
                
                return health_info
            except Exception as e:
                error("健康检查失败", error=e, metadata={
                    "error_type": type(e).__name__
                })
                return {
                    "status": "unhealthy",
                    "health_score": 0,
                    "timestamp": datetime.now().isoformat(),
                    "error": str(e)
                }

@app.get("/api/connections")
async def get_connections():
    """获取连接详情"""
    try:
        stats = await enhanced_manager.get_connection_stats()
        global_metrics = await enhanced_manager.optimizer.get_global_metrics()
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "summary": stats.dict(),
            "global_metrics": global_metrics
        }
    except Exception as e:
        logger.error(f"获取连接信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pile/{pile_id}/stats")
async def get_pile_stats(pile_id: str):
    """获取特定充电桩的统计信息"""
    try:
        pile_stats = await enhanced_manager.get_pile_stats(pile_id)
        
        if pile_stats is None:
            raise HTTPException(status_code=404, detail=f"充电桩 {pile_id} 未找到")
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "pile_id": pile_id,
            "stats": pile_stats
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取充电桩 {pile_id} 统计信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pile/{pile_id}/reset")
async def reset_pile_connection(pile_id: str):
    """重置充电桩连接"""
    try:
        success = await enhanced_manager.reset_pile_connection(pile_id)
        
        if success:
            return {
                "status": "success",
                "message": f"充电桩 {pile_id} 重置命令已发送",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail=f"重置充电桩 {pile_id} 失败")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重置充电桩 {pile_id} 连接失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/connections/cleanup")
async def cleanup_idle_connections():
    """清理空闲连接"""
    try:
        cleaned_count = await enhanced_manager.cleanup_idle_connections()
        
        return {
            "status": "success",
            "message": f"已清理 {cleaned_count} 个空闲连接",
            "cleaned_count": cleaned_count,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"清理空闲连接失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pile/{pile_id}/message")
async def send_message_to_pile(pile_id: str, message: dict):
    """向充电桩发送自定义消息"""
    try:
        # 验证消息格式
        if not isinstance(message, dict) or not message:
            raise HTTPException(status_code=400, detail="消息格式无效")
        
        # 添加时间戳
        message["timestamp"] = datetime.now().isoformat()
        
        # 发送消息
        success = await enhanced_manager.send_message_to_pile(
            pile_id, message, MessagePriority.NORMAL
        )
        
        if success:
            return {
                "status": "success",
                "message": f"消息已发送到充电桩 {pile_id}",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail=f"发送消息到充电桩 {pile_id} 失败")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发送消息到充电桩 {pile_id} 失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 启动事件
@app.on_event("startup")
async def startup_event():
    """服务启动事件"""
    logger.info("OCPP充电服务启动中...")
    
    # 启动增强连接管理器
    await start_connection_manager()
    
    # 初始化服务
    await ocpp_service.initialize()
    await session_manager.initialize()
    await pile_manager.initialize()
    
    logger.info("OCPP充电服务启动完成")

# 关闭事件
@app.on_event("shutdown")
async def shutdown_event():
    """服务关闭事件"""
    logger.info("OCPP充电服务关闭中...")
    
    # 停止增强连接管理器
    await stop_connection_manager()
    
    # 清理资源
    await ocpp_service.cleanup()
    await session_manager.cleanup()
    await pile_manager.cleanup()
    
    logger.info("OCPP充电服务已关闭")

if __name__ == "__main__":
    # 运行服务
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )