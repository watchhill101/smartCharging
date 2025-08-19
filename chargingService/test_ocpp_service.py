"""
OCPP服务测试
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from ocpp_service import OCPPService
from charging_session import ChargingSessionManager
from pile_manager import ChargingPileManager
from models import ChargingPile, ChargingSession

@pytest.fixture
async def ocpp_service():
    """创建OCPP服务实例"""
    service = OCPPService()
    await service.initialize()
    yield service
    await service.cleanup()

@pytest.fixture
async def session_manager():
    """创建会话管理器实例"""
    manager = ChargingSessionManager()
    await manager.initialize()
    yield manager
    await manager.cleanup()

@pytest.fixture
async def pile_manager():
    """创建充电桩管理器实例"""
    manager = ChargingPileManager()
    await manager.initialize()
    yield manager
    await manager.cleanup()

class TestOCPPService:
    """OCPP服务测试"""
    
    @pytest.mark.asyncio
    async def test_handle_boot_notification(self, ocpp_service):
        """测试BootNotification处理"""
        pile_id = "test_pile_001"
        payload = {
            "chargePointVendor": "TestVendor",
            "chargePointModel": "TestModel",
            "chargePointSerialNumber": "TEST001",
            "firmwareVersion": "1.0.0"
        }
        
        response = await ocpp_service.handle_boot_notification(pile_id, payload)
        
        assert response["status"] == "Accepted"
        assert "currentTime" in response
        assert response["interval"] == 300
    
    @pytest.mark.asyncio
    async def test_handle_status_notification(self, ocpp_service):
        """测试StatusNotification处理"""
        pile_id = "test_pile_001"
        payload = {
            "connectorId": 1,
            "status": "Available",
            "errorCode": "NoError"
        }
        
        response = await ocpp_service.handle_status_notification(pile_id, payload)
        
        assert response == {}
    
    @pytest.mark.asyncio
    async def test_handle_heartbeat(self, ocpp_service):
        """测试Heartbeat处理"""
        pile_id = "test_pile_001"
        payload = {}
        
        response = await ocpp_service.handle_heartbeat(pile_id, payload)
        
        assert "currentTime" in response
    
    @pytest.mark.asyncio
    async def test_handle_authorize(self, ocpp_service):
        """测试Authorize处理"""
        pile_id = "test_pile_001"
        payload = {
            "idTag": "test_user_001"
        }
        
        response = await ocpp_service.handle_authorize(pile_id, payload)
        
        assert "idTagInfo" in response
        assert response["idTagInfo"]["status"] == "Accepted"
    
    @pytest.mark.asyncio
    async def test_handle_start_transaction(self, ocpp_service):
        """测试StartTransaction处理"""
        pile_id = "test_pile_001"
        payload = {
            "connectorId": 1,
            "idTag": "test_user_001",
            "meterStart": 1000,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        response = await ocpp_service.handle_start_transaction(pile_id, payload)
        
        assert "idTagInfo" in response
        assert "transactionId" in response
        assert response["idTagInfo"]["status"] == "Accepted"
    
    @pytest.mark.asyncio
    async def test_handle_stop_transaction(self, ocpp_service):
        """测试StopTransaction处理"""
        # 先创建一个交易
        pile_id = "test_pile_001"
        start_payload = {
            "connectorId": 1,
            "idTag": "test_user_001",
            "meterStart": 1000,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        start_response = await ocpp_service.handle_start_transaction(pile_id, start_payload)
        transaction_id = start_response["transactionId"]
        
        # 停止交易
        stop_payload = {
            "transactionId": transaction_id,
            "meterStop": 1500,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": "Local"
        }
        
        response = await ocpp_service.handle_stop_transaction(pile_id, stop_payload)
        
        assert "idTagInfo" in response
        assert response["idTagInfo"]["status"] == "Accepted"
    
    @pytest.mark.asyncio
    async def test_handle_meter_values(self, ocpp_service):
        """测试MeterValues处理"""
        pile_id = "test_pile_001"
        payload = {
            "connectorId": 1,
            "transactionId": 12345,
            "meterValue": [
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "sampledValue": [
                        {
                            "value": "1200",
                            "measurand": "Energy.Active.Import.Register",
                            "unit": "Wh"
                        },
                        {
                            "value": "7.5",
                            "measurand": "Power.Active.Import",
                            "unit": "kW"
                        }
                    ]
                }
            ]
        }
        
        response = await ocpp_service.handle_meter_values(pile_id, payload)
        
        assert response == {}
    
    @pytest.mark.asyncio
    async def test_message_parsing(self, ocpp_service):
        """测试OCPP消息解析"""
        pile_id = "test_pile_001"
        
        # 测试CALL消息
        call_message = [2, "12345", "Heartbeat", {}]
        response = await ocpp_service.handle_message(pile_id, call_message)
        
        assert response[0] == 3  # CALLRESULT
        assert response[1] == "12345"
        assert "currentTime" in response[2]
        
        # 测试无效消息格式
        invalid_message = ["invalid"]
        response = await ocpp_service.handle_message(pile_id, invalid_message)
        
        assert response[0] == 4  # CALLERROR
        assert response[2] == "FormatViolation"

class TestChargingSessionManager:
    """充电会话管理器测试"""
    
    @pytest.mark.asyncio
    async def test_create_session(self, session_manager):
        """测试创建充电会话"""
        session = await session_manager.create_session(
            pile_id="test_pile_001",
            user_id="test_user_001",
            connector_id=1,
            id_tag="test_tag_001"
        )
        
        assert session.pile_id == "test_pile_001"
        assert session.user_id == "test_user_001"
        assert session.connector_id == 1
        assert session.id_tag == "test_tag_001"
        assert session.session_id in session_manager.sessions
    
    @pytest.mark.asyncio
    async def test_end_session(self, session_manager):
        """测试结束充电会话"""
        # 创建会话
        session = await session_manager.create_session(
            pile_id="test_pile_001",
            user_id="test_user_001",
            connector_id=1,
            id_tag="test_tag_001"
        )
        
        # 结束会话
        ended_session = await session_manager.end_session(session.session_id, "Local")
        
        assert ended_session.end_time is not None
        assert ended_session.stop_reason == "Local"
    
    @pytest.mark.asyncio
    async def test_update_meter_values(self, session_manager):
        """测试更新电表数据"""
        # 创建会话
        session = await session_manager.create_session_from_pile(
            pile_id="test_pile_001",
            connector_id=1,
            id_tag="test_tag_001",
            transaction_id=12345,
            meter_start=1000.0,
            start_time=datetime.now(timezone.utc).isoformat()
        )
        
        # 更新电表数据
        meter_values = [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "sampledValue": [
                    {
                        "value": "1200",
                        "measurand": "Energy.Active.Import.Register",
                        "unit": "Wh"
                    },
                    {
                        "value": "7.5",
                        "measurand": "Power.Active.Import",
                        "unit": "kW"
                    }
                ]
            }
        ]
        
        await session_manager.update_meter_values(12345, meter_values)
        
        updated_session = await session_manager.get_session(session.session_id)
        assert updated_session.energy_delivered == 1.2  # 1200Wh = 1.2kWh
        assert updated_session.current_power == 7.5
    
    @pytest.mark.asyncio
    async def test_get_sessions(self, session_manager):
        """测试获取会话列表"""
        # 创建多个会话
        await session_manager.create_session(
            pile_id="test_pile_001",
            user_id="test_user_001",
            connector_id=1,
            id_tag="test_tag_001"
        )
        
        await session_manager.create_session(
            pile_id="test_pile_002",
            user_id="test_user_002",
            connector_id=1,
            id_tag="test_tag_002"
        )
        
        # 获取所有会话
        all_sessions = await session_manager.get_sessions()
        assert len(all_sessions) == 2
        
        # 按充电桩过滤
        pile_sessions = await session_manager.get_sessions(pile_id="test_pile_001")
        assert len(pile_sessions) == 1
        assert pile_sessions[0].pile_id == "test_pile_001"

class TestChargingPileManager:
    """充电桩管理器测试"""
    .
    @pytest.mark.asyncio
    async def test_register_pile(self, pile_manager):
        """测试注册充电桩"""
        pile_id = "test_pile_001"
        websocket = MagicMock()
        
        await pile_manager.register_pile(pile_id, websocket)
        
        pile = await pile_manager.get_pile(pile_id)
        assert pile is not None
        assert pile.pile_id == pile_id
        assert pile.is_online is True
        assert pile.websocket == websocket
    
    @pytest.mark.asyncio
    async def test_unregister_pile(self, pile_manager):
        """测试注销充电桩"""
        pile_id = "test_pile_001"
        websocket = MagicMock()
        
        # 先注册
        await pile_manager.register_pile(pile_id, websocket)
        
        # 再注销
        await pile_manager.unregister_pile(pile_id)
        
        pile = await pile_manager.get_pile(pile_id)
        assert pile.is_online is False
        assert pile.websocket is None
    
    @pytest.mark.asyncio
    async def test_update_connector_status(self, pile_manager):
        """测试更新连接器状态"""
        pile_id = "test_pile_001"
        websocket = MagicMock()
        
        await pile_manager.register_pile(pile_id, websocket)
        await pile_manager.update_connector_status(pile_id, 1, "Charging", "NoError")
        
        pile = await pile_manager.get_pile(pile_id)
        connector = pile.connectors[0]
        assert connector.status.value == "Charging"
        assert connector.error_code == "NoError"
    
    @pytest.mark.asyncio
    async def test_get_pile_statistics(self, pile_manager):
        """测试获取充电桩统计"""
        # 注册几个充电桩
        await pile_manager.register_pile("pile_001", MagicMock())
        await pile_manager.register_pile("pile_002", MagicMock())
        
        # 设置不同状态
        await pile_manager.update_connector_status("pile_001", 1, "Available")
        await pile_manager.update_connector_status("pile_002", 1, "Charging")
        
        stats = await pile_manager.get_pile_statistics()
        
        assert stats["total_piles"] >= 2
        assert stats["online_piles"] >= 2
        assert stats["online_rate"] > 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])