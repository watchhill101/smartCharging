import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, Camera, Image, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";
import {
  Button as NutButton,
  Toast,
  Dialog,
  Popup,
  Loading,
  Icon,
} from "@nutui/nutui-react-taro";
import "./index.scss";

export interface QRScannerProps {
  // 扫描配置
  scanType?: "qr" | "barcode" | "all";
  continuous?: boolean;
  autoFocus?: boolean;

  // 显示配置
  visible?: boolean;
  showGallery?: boolean;
  showManualInput?: boolean;
  showFlashlight?: boolean;

  // 扫描框配置
  scanAreaSize?: number;
  scanAreaColor?: string;

  // 回调函数
  onScanSuccess?: (result: ScanResult) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;

  // 文案配置
  text?: {
    title: string;
    tip: string;
    gallery: string;
    manual: string;
    flashlight: string;
    inputPlaceholder: string;
    inputConfirm: string;
    inputCancel: string;
  };

  className?: string;
}

export interface ScanResult {
  result: string;
  scanType: string;
  charSet?: string;
  path?: string;
}

interface ScannerState {
  // 扫描状态
  scanning: boolean;
  flashlightOn: boolean;

  // 手动输入
  showManualInput: boolean;
  manualInputValue: string;

  // 相册选择
  showGalleryOptions: boolean;

  // 错误状态
  error: string | null;

  // 权限状态
  cameraPermission: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({
  scanType = "qr",
  continuous = false,
  autoFocus = true,
  visible = false,
  showGallery = true,
  showManualInput = true,
  showFlashlight = true,
  scanAreaSize = 200,
  scanAreaColor = "#00ff00",
  onScanSuccess,
  onScanError,
  onClose,
  text = {
    title: "扫描二维码",
    tip: "将二维码放入框内，即可自动扫描",
    gallery: "相册",
    manual: "手动输入",
    flashlight: "闪光灯",
    inputPlaceholder: "请输入充电桩编号",
    inputConfirm: "确认",
    inputCancel: "取消",
  },
  className = "",
}) => {
  const [state, setState] = useState<ScannerState>({
    scanning: false,
    flashlightOn: false,
    showManualInput: false,
    manualInputValue: "",
    showGalleryOptions: false,
    error: null,
    cameraPermission: false,
  });

  const cameraRef = useRef<any>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 检查相机权限
  const checkCameraPermission = useCallback(async () => {
    try {
      const result = await Taro.getSetting();
      const cameraAuth = result.authSetting["scope.camera"];

      if (cameraAuth === false) {
        // 用户拒绝了权限，引导用户去设置
        Dialog.confirm({
          title: "需要相机权限",
          content: "扫描二维码需要使用相机，请在设置中开启相机权限",
          confirmText: "去设置",
          cancelText: "取消",
          onConfirm: () => {
            Taro.openSetting();
          },
        });
        return false;
      } else if (cameraAuth === undefined) {
        // 还未授权，请求权限
        try {
          await Taro.authorize({ scope: "scope.camera" });
          setState((prev) => ({ ...prev, cameraPermission: true }));
          return true;
        } catch (error) {
          console.error("❌ 相机权限授权失败:", error);
          onScanError?.("相机权限授权失败");
          return false;
        }
      } else {
        // 已授权
        setState((prev) => ({ ...prev, cameraPermission: true }));
        return true;
      }
    } catch (error) {
      console.error("❌ 检查相机权限失败:", error);
      onScanError?.("检查相机权限失败");
      return false;
    }
  }, [onScanError]);

  // 初始化扫描器
  useEffect(() => {
    if (visible) {
      checkCameraPermission().then((hasPermission) => {
        if (hasPermission) {
          setState((prev) => ({ ...prev, scanning: true, error: null }));
        }
      });
    } else {
      setState((prev) => ({
        ...prev,
        scanning: false,
        flashlightOn: false,
        error: null,
      }));
    }
  }, [visible, checkCameraPermission]);

  // 处理扫描成功
  const handleScanSuccess = useCallback(
    (event: any) => {
      const { result, scanType: type, charSet, path } = event.detail;

      if (!result) return;

      console.log("📱 扫描成功:", { result, type, charSet, path });

      // 验证扫描结果
      if (validateScanResult(result)) {
        const scanResult: ScanResult = {
          result,
          scanType: type || scanType,
          charSet,
          path,
        };

        onScanSuccess?.(scanResult);

        Toast.show({
          content: "扫描成功",
          type: "success",
          duration: 1500,
        });

        // 如果不是连续扫描，关闭扫描器
        if (!continuous) {
          handleClose();
        }
      } else {
        onScanError?.("无效的二维码格式");
        Toast.show({
          content: "无效的二维码格式",
          type: "error",
          duration: 2000,
        });
      }
    },
    [scanType, onScanSuccess, onScanError, continuous]
  );

  // 处理扫描失败
  const handleScanError = useCallback(
    (event: any) => {
      const error = event.detail?.errMsg || "扫描失败";
      console.error("❌ 扫描失败:", error);

      setState((prev) => ({ ...prev, error }));
      onScanError?.(error);
    },
    [onScanError]
  );

  // 验证扫描结果
  const validateScanResult = useCallback((result: string): boolean => {
    if (!result || result.trim().length === 0) {
      return false;
    }

    // 这里可以添加更多的验证逻辑
    // 例如：验证充电桩编号格式、URL格式等

    // 简单的充电桩编号验证（假设格式为字母+数字）
    const pileNumberPattern = /^[A-Z]{1,3}\d{2,6}$/i;

    // URL格式验证
    const urlPattern = /^https?:\/\/.+/i;

    // 通用二维码内容验证（至少3个字符）
    const generalPattern = /.{3,}/;

    return (
      pileNumberPattern.test(result) ||
      urlPattern.test(result) ||
      generalPattern.test(result)
    );
  }, []);

  // 切换闪光灯
  const toggleFlashlight = useCallback(() => {
    setState((prev) => ({ ...prev, flashlightOn: !prev.flashlightOn }));
  }, []);

  // 从相册选择图片
  const handleGallerySelect = useCallback(async () => {
    try {
      const result = await Taro.chooseImage({
        count: 1,
        sizeType: ["original"],
        sourceType: ["album"],
      });

      if (result.tempFilePaths && result.tempFilePaths.length > 0) {
        const imagePath = result.tempFilePaths[0];

        // 调用图片二维码识别API
        try {
          // 这里应该调用后端API或第三方服务识别图片中的二维码
          // const scanResult = await qrService.scanImageQR(imagePath);

          // 模拟识别结果
          Toast.show({
            content: "正在识别图片中的二维码...",
            type: "loading",
            duration: 2000,
          });

          // 模拟识别延迟
          setTimeout(() => {
            // 这里应该是实际的识别结果
            const mockResult = "A001"; // 模拟识别到的充电桩编号

            if (validateScanResult(mockResult)) {
              const scanResult: ScanResult = {
                result: mockResult,
                scanType: "qr",
                path: imagePath,
              };

              onScanSuccess?.(scanResult);
              Toast.show({
                content: "识别成功",
                type: "success",
                duration: 1500,
              });
            } else {
              onScanError?.("图片中未发现有效的二维码");
              Toast.show({
                content: "图片中未发现有效的二维码",
                type: "error",
                duration: 2000,
              });
            }
          }, 2000);
        } catch (error) {
          console.error("❌ 图片二维码识别失败:", error);
          onScanError?.("图片二维码识别失败");
          Toast.show({
            content: "图片二维码识别失败",
            type: "error",
            duration: 2000,
          });
        }
      }
    } catch (error) {
      console.error("❌ 选择图片失败:", error);
      Toast.show({
        content: "选择图片失败",
        type: "error",
        duration: 2000,
      });
    }
  }, [onScanSuccess, onScanError, validateScanResult]);

  // 手动输入确认
  const handleManualInputConfirm = useCallback(() => {
    const inputValue = state.manualInputValue.trim();

    if (!inputValue) {
      Toast.show({
        content: "请输入充电桩编号",
        type: "warning",
        duration: 2000,
      });
      return;
    }

    if (validateScanResult(inputValue)) {
      const scanResult: ScanResult = {
        result: inputValue,
        scanType: "manual",
      };

      onScanSuccess?.(scanResult);
      setState((prev) => ({
        ...prev,
        showManualInput: false,
        manualInputValue: "",
      }));

      Toast.show({
        content: "输入成功",
        type: "success",
        duration: 1500,
      });
    } else {
      Toast.show({
        content: "请输入有效的充电桩编号",
        type: "error",
        duration: 2000,
      });
    }
  }, [state.manualInputValue, validateScanResult, onScanSuccess]);

  // 关闭扫描器
  const handleClose = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scanning: false,
      flashlightOn: false,
      showManualInput: false,
      manualInputValue: "",
      error: null,
    }));
    onClose?.();
  }, [onClose]);

  // 重新扫描
  const handleRescan = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, scanning: true }));
  }, []);

  if (!visible) return null;

  return (
    <View className={`qr-scanner ${className}`}>
      {/* 扫描器头部 */}
      <View className="scanner-header">
        <View className="header-left">
          <NutButton
            type="default"
            size="small"
            onClick={handleClose}
            className="close-btn"
          >
            ✕
          </NutButton>
        </View>

        <View className="header-center">
          <Text className="scanner-title">{text.title}</Text>
        </View>

        <View className="header-right">
          {showFlashlight && (
            <NutButton
              type={state.flashlightOn ? "primary" : "default"}
              size="small"
              onClick={toggleFlashlight}
              className="flashlight-btn"
            >
              💡
            </NutButton>
          )}
        </View>
      </View>

      {/* 扫描区域 */}
      <View className="scanner-content">
        {state.cameraPermission && state.scanning && !state.error ? (
          <View className="camera-container">
            <Camera
              ref={cameraRef}
              className="camera-view"
              devicePosition="back"
              flash={state.flashlightOn ? "on" : "off"}
              autoFocus={autoFocus}
              scanArea={{
                x: (375 - scanAreaSize) / 2 / 375,
                y: (667 - scanAreaSize) / 2 / 667,
                width: scanAreaSize / 375,
                height: scanAreaSize / 667,
              }}
              onScanCode={handleScanSuccess}
              onError={handleScanError}
            />

            {/* 扫描框 */}
            <View className="scan-overlay">
              <View
                className="scan-area"
                style={{
                  width: `${scanAreaSize}px`,
                  height: `${scanAreaSize}px`,
                  borderColor: scanAreaColor,
                }}
              >
                {/* 扫描线动画 */}
                <View className="scan-line" />

                {/* 四个角的装饰 */}
                <View className="corner corner-top-left" />
                <View className="corner corner-top-right" />
                <View className="corner corner-bottom-left" />
                <View className="corner corner-bottom-right" />
              </View>
            </View>
          </View>
        ) : state.error ? (
          // 错误状态
          <View className="error-container">
            <Text className="error-icon">❌</Text>
            <Text className="error-text">{state.error}</Text>
            <NutButton
              type="primary"
              onClick={handleRescan}
              className="rescan-btn"
            >
              重新扫描
            </NutButton>
          </View>
        ) : (
          // 加载状态
          <View className="loading-container">
            <Loading type="spinner" />
            <Text className="loading-text">正在启动相机...</Text>
          </View>
        )}
      </View>

      {/* 提示文字 */}
      <View className="scanner-tip">
        <Text className="tip-text">{text.tip}</Text>
      </View>

      {/* 底部操作栏 */}
      <View className="scanner-actions">
        {showGallery && (
          <NutButton
            type="default"
            onClick={handleGallerySelect}
            className="action-btn"
          >
            📷 {text.gallery}
          </NutButton>
        )}

        {showManualInput && (
          <NutButton
            type="default"
            onClick={() =>
              setState((prev) => ({ ...prev, showManualInput: true }))
            }
            className="action-btn"
          >
            ⌨️ {text.manual}
          </NutButton>
        )}
      </View>

      {/* 手动输入弹窗 */}
      <Popup
        visible={state.showManualInput}
        position="bottom"
        closeable
        onClose={() =>
          setState((prev) => ({
            ...prev,
            showManualInput: false,
            manualInputValue: "",
          }))
        }
        className="manual-input-popup"
      >
        <View className="manual-input-content">
          <Text className="input-title">手动输入充电桩编号</Text>

          <Input
            type="text"
            placeholder={text.inputPlaceholder}
            value={state.manualInputValue}
            onInput={(e) =>
              setState((prev) => ({
                ...prev,
                manualInputValue: e.detail.value,
              }))
            }
            className="manual-input"
            maxlength={20}
            focus
          />

          <View className="input-actions">
            <NutButton
              type="default"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  showManualInput: false,
                  manualInputValue: "",
                }))
              }
              className="input-cancel-btn"
            >
              {text.inputCancel}
            </NutButton>

            <NutButton
              type="primary"
              onClick={handleManualInputConfirm}
              className="input-confirm-btn"
            >
              {text.inputConfirm}
            </NutButton>
          </View>
        </View>
      </Popup>
    </View>
  );
};

export default QRScanner;
