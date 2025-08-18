import { View, Text } from "@tarojs/components";
import { useLoad } from "@tarojs/taro";
import "./index.scss";
import { SafeButton } from "../../utils/platform";
import Taro from "@tarojs/taro";

export default function Index() {
  useLoad(() => {
    console.log("智能充电应用启动");
  });
  const theScan = () => {
    // 跳转到扫码页面
    Taro.navigateTo({
      url: "/pages/scan/index",
    });
  };

  return (
    <View className="index">
      <Text className="welcome-text">智能充电</Text>
    </View>
  );
}
//scan
