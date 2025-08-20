import { View, Text } from '@tarojs/components'
import './index.scss'

interface ChargingControlProps {
  stationId?: string
  onChargingStart?: (settings: ChargingSettings) => void
  onChargingStop?: () => void
}

interface ChargingSettings {
  maxEnergy: number
  maxCost: number
  autoStop: boolean
  powerLimit: number
}

const ChargingControl: React.FC<ChargingControlProps> = () => {

  return (
    <View className='charging-control'>
      <Text>充电控制组件</Text>
    </View>
  )
}

export default ChargingControl