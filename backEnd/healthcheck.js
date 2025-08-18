/**
 * Docker健康检查脚本
 * 检查应用程序、数据库和缓存服务的连接状态
 */

const http = require('http');

const healthcheck = () => {
  const options = {
    hostname: 'localhost',
    port: process.env.PORT || 8080,
    path: '/health',
    method: 'GET',
    timeout: 2000,
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const healthData = JSON.parse(data);
          
          if (healthData.status === 'OK') {
            const dbConnected = healthData.services?.database === 'connected';
            const redisConnected = healthData.services?.redis === 'connected';
            
            if (dbConnected && redisConnected) {
              console.log('✅ 健康检查通过');
              process.exit(0);
            } else {
              console.log('❌ 数据库或缓存服务异常');
              process.exit(1);
            }
          } else {
            console.log('❌ 应用状态异常');
            process.exit(1);
          }
        } catch (error) {
          console.log('❌ 响应格式错误');
          process.exit(1);
        }
      });
    } else {
      console.log('❌ HTTP状态码异常');
      process.exit(1);
    }
  });

  req.on('error', (error) => {
    console.log('❌ 连接错误:', error.message);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.log('❌ 请求超时');
    req.destroy();
    process.exit(1);
  });

  req.setTimeout(2000);
  req.end();
};

healthcheck();
