const fs = require('fs');
const forge = require('node-forge');

try {
  // 读取 PFX 文件
  const pfxData = fs.readFileSync('cert.pfx');
  
  // 解析 PFX (密码是 "password")
  const p12Asn1 = forge.asn1.fromDer(pfxData.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, 'password');
  
  // 获取私钥
  const keyBags = p12.getBags({bagType: forge.pki.oids.pkcs8ShroudedKeyBag});
  const key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
  
  // 获取证书
  const certBags = p12.getBags({bagType: forge.pki.oids.certBag});
  const cert = certBags[forge.pki.oids.certBag][0].cert;
  
  // 转换为 PEM 格式
  const privateKeyPem = forge.pki.privateKeyToPem(key);
  const certificatePem = forge.pki.certificateToPem(cert);
  
  // 写入文件
  fs.writeFileSync('key.pem', privateKeyPem);
  fs.writeFileSync('cert.pem', certificatePem);
  
  console.log('证书转换成功！');
  console.log('生成的文件：');
  console.log('- key.pem (私钥)');
  console.log('- cert.pem (证书)');
} catch (error) {
  console.error('转换失败:', error.message);
}
