// 在frontEnd目录下创建generate-cert.js
const fs = require('fs');
const forge = require('node-forge');

// 创建一个证书
const generateCertificate = () => {
  console.log('生成自签名证书...');
  
  // 生成一对公钥/私钥
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // 创建证书
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  // 设置证书信息
  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'CN' },
    { name: 'localityName', value: 'LocalCity' },
    { name: 'organizationName', value: 'DevOrg' },
    { name: 'organizationalUnitName', value: 'Dev' }
  ];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  
  // 设置扩展
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' }
      ]
    }
  ]);
  
  // 使用私钥对证书进行签名
  cert.sign(keys.privateKey, forge.md.sha256.create());
  
  // 将证书和私钥转换为PEM格式
  const certPem = forge.pki.certificateToPem(cert);
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  
  // 确保cert目录存在
  if (!fs.existsSync('./cert')) {
    fs.mkdirSync('./cert');
  }
  
  // 保存证书和私钥到文件
  fs.writeFileSync('./cert/cert.pem', certPem);
  fs.writeFileSync('./cert/key.pem', privateKeyPem);
  
  console.log('证书生成完成！');
};

generateCertificate();