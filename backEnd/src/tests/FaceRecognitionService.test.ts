import { FaceRecognitionService } from '../services/FaceRecognitionService';
import { RedisService } from '../services/RedisService';

// Mock Redis service
jest.mock('../services/RedisService');

describe('FaceRecognitionService', () => {
  let faceRecognitionService: FaceRecognitionService;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      getClient: jest.fn()
    } as any;

    faceRecognitionService = new FaceRecognitionService();
    (faceRecognitionService as any).redis = mockRedisService;
  });

  describe('detectFace', () => {
    it('should detect face successfully with valid image', async () => {
      // Create a mock JPEG image buffer
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockImageBuffer = Buffer.concat([jpegHeader, Buffer.alloc(10000, 0x00)]);

      const result = await faceRecognitionService.detectFace(mockImageBuffer);

      expect(result.success).toBe(true);
      expect(result.data?.faceDetected).toBe(true);
      expect(result.data?.features.encoding).toHaveLength(128);
      expect(result.data?.features.landmarks).toHaveLength(68);
      expect(result.data?.confidence).toBeGreaterThan(0);
    });

    it('should fail with oversized image', async () => {
      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0xFF);

      const result = await faceRecognitionService.detectFace(largeBuffer);

      expect(result.success).toBe(false);
      expect(result.message).toBe('图片文件过大，请选择小于5MB的图片');
    });

    it('should fail with undersized image', async () => {
      const smallBuffer = Buffer.alloc(500, 0xFF);

      const result = await faceRecognitionService.detectFace(smallBuffer);

      expect(result.success).toBe(false);
      expect(result.message).toBe('图片文件过小，请选择有效的图片文件');
    });

    it('should fail with unsupported image format', async () => {
      // Create a buffer with invalid header
      const invalidBuffer = Buffer.alloc(2000, 0x00);

      const result = await faceRecognitionService.detectFace(invalidBuffer);

      expect(result.success).toBe(false);
      expect(result.message).toBe('不支持的图片格式，请使用JPEG或PNG格式');
    });

    it('should accept PNG format', async () => {
      // Create a mock PNG image buffer
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      const mockImageBuffer = Buffer.concat([pngHeader, Buffer.alloc(10000, 0x00)]);

      const result = await faceRecognitionService.detectFace(mockImageBuffer);

      expect(result.success).toBe(true);
    });

    it('should handle detection failure due to poor image quality', async () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockImageBuffer = Buffer.concat([jpegHeader, Buffer.alloc(2000, 0x00)]);

      // Mock the detection to return poor quality
      const originalMockDetection = (faceRecognitionService as any).mockFaceDetection;
      (faceRecognitionService as any).mockFaceDetection = jest.fn().mockResolvedValue({
        faceDetected: true,
        features: {
          encoding: Array.from({ length: 128 }, () => Math.random()),
          landmarks: Array.from({ length: 68 }, () => [100, 100]),
          confidence: 0.8
        },
        confidence: 0.8,
        quality: {
          brightness: 0.1, // Too dark
          sharpness: 0.3,  // Too blurry
          pose: { yaw: 0, pitch: 0, roll: 0 }
        }
      });

      const result = await faceRecognitionService.detectFace(mockImageBuffer);

      expect(result.success).toBe(false);
      expect(result.message).toBe('图片亮度不合适，请在光线充足的环境下拍摄');

      // Restore original method
      (faceRecognitionService as any).mockFaceDetection = originalMockDetection;
    });

    it('should handle detection failure due to face angle', async () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockImageBuffer = Buffer.concat([jpegHeader, Buffer.alloc(2000, 0x00)]);

      const originalMockDetection = (faceRecognitionService as any).mockFaceDetection;
      (faceRecognitionService as any).mockFaceDetection = jest.fn().mockResolvedValue({
        faceDetected: true,
        features: {
          encoding: Array.from({ length: 128 }, () => Math.random()),
          landmarks: Array.from({ length: 68 }, () => [100, 100]),
          confidence: 0.8
        },
        confidence: 0.8,
        quality: {
          brightness: 0.6,
          sharpness: 0.8,
          pose: { yaw: 45, pitch: 0, roll: 0 } // Too much yaw
        }
      });

      const result = await faceRecognitionService.detectFace(mockImageBuffer);

      expect(result.success).toBe(false);
      expect(result.message).toBe('请保持面部正对摄像头，避免过度倾斜');

      (faceRecognitionService as any).mockFaceDetection = originalMockDetection;
    });
  });

  describe('detectLiveness', () => {
    it('should detect liveness successfully', async () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockImageBuffer = Buffer.concat([jpegHeader, Buffer.alloc(2000, 0x00)]);

      const result = await faceRecognitionService.detectLiveness(mockImageBuffer);

      expect(result.success).toBe(true);
      expect(result.data?.isLive).toBe(true);
      expect(result.data?.score).toBeGreaterThan(0);
      expect(result.data?.confidence).toBeGreaterThan(0);
    });

    it('should handle liveness detection failure', async () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockImageBuffer = Buffer.concat([jpegHeader, Buffer.alloc(2000, 0x00)]);

      // Mock the liveness detection to fail
      const originalMockLiveness = (faceRecognitionService as any).mockLivenessDetection;
      (faceRecognitionService as any).mockLivenessDetection = jest.fn().mockResolvedValue({
        isLive: false,
        score: 0.3,
        confidence: 0.8
      });

      const result = await faceRecognitionService.detectLiveness(mockImageBuffer);

      expect(result.success).toBe(false);
      expect(result.message).toBe('活体检测失败，请确保是真人操作');

      (faceRecognitionService as any).mockLivenessDetection = originalMockLiveness;
    });

    it('should accept custom actions for liveness detection', async () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockImageBuffer = Buffer.concat([jpegHeader, Buffer.alloc(2000, 0x00)]);
      const actions = ['blink', 'smile', 'turn_head'];

      const result = await faceRecognitionService.detectLiveness(mockImageBuffer, actions);

      expect(result.success).toBe(true);
      expect(result.data?.actions).toEqual(actions);
    });
  });

  describe('compareFaces', () => {
    it('should compare faces successfully with high similarity', async () => {
      const encoding1 = Array.from({ length: 128 }, () => 0.5);
      const encoding2 = Array.from({ length: 128 }, () => 0.51); // Very similar

      const result = await faceRecognitionService.compareFaces(encoding1, encoding2);

      expect(result.success).toBe(true);
      expect(result.data?.isMatch).toBe(true);
      expect(result.data?.similarity).toBeGreaterThan(0.8);
      expect(result.data?.threshold).toBe(0.8);
    });

    it('should compare faces successfully with low similarity', async () => {
      const encoding1 = Array.from({ length: 128 }, () => 0.5);
      const encoding2 = Array.from({ length: 128 }, () => -0.5); // Very different

      const result = await faceRecognitionService.compareFaces(encoding1, encoding2);

      expect(result.success).toBe(true);
      expect(result.data?.isMatch).toBe(false);
      expect(result.data?.similarity).toBeLessThan(0.8);
    });

    it('should fail with invalid encoding arrays', async () => {
      const encoding1 = Array.from({ length: 128 }, () => 0.5);
      const encoding2 = Array.from({ length: 64 }, () => 0.5); // Wrong length

      const result = await faceRecognitionService.compareFaces(encoding1, encoding2);

      expect(result.success).toBe(false);
      expect(result.message).toBe('人脸特征数据无效');
    });

    it('should fail with null or undefined encodings', async () => {
      const encoding1 = Array.from({ length: 128 }, () => 0.5);

      let result = await faceRecognitionService.compareFaces(encoding1, null as any);
      expect(result.success).toBe(false);

      result = await faceRecognitionService.compareFaces(null as any, encoding1);
      expect(result.success).toBe(false);

      result = await faceRecognitionService.compareFaces(undefined as any, undefined as any);
      expect(result.success).toBe(false);
    });
  });

  describe('generateFaceId', () => {
    it('should generate unique face IDs', () => {
      const id1 = faceRecognitionService.generateFaceId();
      const id2 = faceRecognitionService.generateFaceId();

      expect(id1).toMatch(/^face_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^face_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = faceRecognitionService.generateFaceId();
      const parts = id.split('_');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('face');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });
  });

  describe('getConfiguration', () => {
    it('should return correct configuration', () => {
      const config = faceRecognitionService.getConfiguration();

      expect(config).toEqual({
        similarityThreshold: 0.8,
        livenessThreshold: 0.7,
        qualityThreshold: 0.6,
        maxFaceProfiles: 3,
        supportedFormats: ['JPEG', 'PNG'],
        maxFileSize: '5MB',
        minImageSize: '100x100',
        recommendedSize: '640x480'
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const result = await faceRecognitionService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.message).toBe('人脸识别服务运行正常');
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should handle health check errors gracefully', async () => {
      // Mock validateImage to throw an error
      const originalValidateImage = (faceRecognitionService as any).validateImage;
      (faceRecognitionService as any).validateImage = jest.fn().mockImplementation(() => {
        throw new Error('Service error');
      });

      const result = await faceRecognitionService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('人脸识别服务异常');

      // Restore original method
      (faceRecognitionService as any).validateImage = originalValidateImage;
    });
  });

  describe('Private Methods', () => {
    describe('calculateEuclideanDistance', () => {
      it('should calculate distance correctly', () => {
        const vector1 = [1, 2, 3];
        const vector2 = [4, 5, 6];
        
        const distance = (faceRecognitionService as any).calculateEuclideanDistance(vector1, vector2);
        
        // Expected distance: sqrt((4-1)^2 + (5-2)^2 + (6-3)^2) = sqrt(9 + 9 + 9) = sqrt(27) ≈ 5.196
        expect(distance).toBeCloseTo(5.196, 2);
      });

      it('should return 0 for identical vectors', () => {
        const vector = [1, 2, 3, 4, 5];
        
        const distance = (faceRecognitionService as any).calculateEuclideanDistance(vector, vector);
        
        expect(distance).toBe(0);
      });
    });

    describe('seededRandom', () => {
      it('should generate consistent random numbers with same seed', () => {
        const seed = 12345;
        const random1 = (faceRecognitionService as any).seededRandom(seed);
        const random2 = (faceRecognitionService as any).seededRandom(seed);

        const values1 = [random1(), random1(), random1()];
        const values2 = [random2(), random2(), random2()];

        expect(values1).toEqual(values2);
      });

      it('should generate different sequences with different seeds', () => {
        const random1 = (faceRecognitionService as any).seededRandom(12345);
        const random2 = (faceRecognitionService as any).seededRandom(54321);

        const values1 = [random1(), random1(), random1()];
        const values2 = [random2(), random2(), random2()];

        expect(values1).not.toEqual(values2);
      });

      it('should generate numbers between 0 and 1', () => {
        const random = (faceRecognitionService as any).seededRandom(12345);
        
        for (let i = 0; i < 100; i++) {
          const value = random();
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      });
    });

    describe('checkImageQuality', () => {
      it('should pass quality check with good parameters', () => {
        const quality = {
          brightness: 0.6,
          sharpness: 0.8,
          pose: { yaw: 10, pitch: 5, roll: 3 }
        };

        const result = (faceRecognitionService as any).checkImageQuality(quality);

        expect(result.passed).toBe(true);
      });

      it('should fail quality check with poor brightness', () => {
        const quality = {
          brightness: 0.1, // Too dark
          sharpness: 0.8,
          pose: { yaw: 10, pitch: 5, roll: 3 }
        };

        const result = (faceRecognitionService as any).checkImageQuality(quality);

        expect(result.passed).toBe(false);
        expect(result.message).toBe('图片亮度不合适，请在光线充足的环境下拍摄');
      });

      it('should fail quality check with poor sharpness', () => {
        const quality = {
          brightness: 0.6,
          sharpness: 0.3, // Too blurry
          pose: { yaw: 10, pitch: 5, roll: 3 }
        };

        const result = (faceRecognitionService as any).checkImageQuality(quality);

        expect(result.passed).toBe(false);
        expect(result.message).toBe('图片模糊，请重新拍摄清晰的照片');
      });

      it('should fail quality check with extreme pose angles', () => {
        const quality = {
          brightness: 0.6,
          sharpness: 0.8,
          pose: { yaw: 40, pitch: 5, roll: 3 } // Yaw too large
        };

        const result = (faceRecognitionService as any).checkImageQuality(quality);

        expect(result.passed).toBe(false);
        expect(result.message).toBe('请保持面部正对摄像头，避免过度倾斜');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock an internal error
      const originalMockDetection = (faceRecognitionService as any).mockFaceDetection;
      (faceRecognitionService as any).mockFaceDetection = jest.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockImageBuffer = Buffer.concat([jpegHeader, Buffer.alloc(2000, 0x00)]);

      const result = await faceRecognitionService.detectFace(mockImageBuffer);

      expect(result.success).toBe(false);
      expect(result.message).toBe('人脸检测服务暂时不可用，请稍后重试');

      (faceRecognitionService as any).mockFaceDetection = originalMockDetection;
    });

    it('should handle comparison errors gracefully', async () => {
      // Mock an error in distance calculation
      const originalCalculateDistance = (faceRecognitionService as any).calculateEuclideanDistance;
      (faceRecognitionService as any).calculateEuclideanDistance = jest.fn().mockImplementation(() => {
        throw new Error('Calculation error');
      });

      const encoding1 = Array.from({ length: 128 }, () => 0.5);
      const encoding2 = Array.from({ length: 128 }, () => 0.5);

      const result = await faceRecognitionService.compareFaces(encoding1, encoding2);

      expect(result.success).toBe(false);
      expect(result.message).toBe('人脸比较过程中出现错误');

      (faceRecognitionService as any).calculateEuclideanDistance = originalCalculateDistance;
    });
  });
});