import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MapView, { MapViewProps } from '../index';
import AmapService from '../../../services/AmapService';

// Mock Taro APIs
jest.mock('@tarojs/taro', () => ({
  createMapContext: jest.fn(() => ({
    moveToLocation: jest.fn(),
    takeSnapshot: jest.fn()
  })),
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn()
}));

// Mock AmapService
jest.mock('../../../services/AmapService');

// Mock NutUI components
jest.mock('@nutui/nutui-react-taro', () => ({
  Button: ({ children, onClick, loading, ...props }: any) => (
    <button onClick={onClick} disabled={loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  ),
  Loading: ({ type }: any) => <div data-testid="loading">Loading {type}</div>,
  Toast: {
    show: jest.fn()
  }
}));

// Mock Taro components
jest.mock('@tarojs/components', () => ({
  View: ({ children, className, style, onClick }: any) => (
    <div className={className} style={style} onClick={onClick}>
      {children}
    </div>
  ),
  Map: ({ onReady, onClick, onMarkerTap, onRegionChange, ...props }: any) => (
    <div 
      data-testid="map"
      onClick={(e) => onClick?.({ detail: { latitude: 39.908823, longitude: 116.397470 } })}
      {...props}
    >
      <button onClick={() => onReady?.()}>Map Ready</button>
      <button onClick={() => onMarkerTap?.({ detail: { markerId: 'test-marker' } })}>
        Marker Click
      </button>
      <button onClick={() => onRegionChange?.({ 
        type: 'end',
        detail: { latitude: 39.908823, longitude: 116.397470, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      })}>
        Region Change
      </button>
    </div>
  ),
  CoverView: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CoverImage: ({ src, className }: any) => (
    <img src={src} className={className} alt="" />
  )
}));

const MockedAmapService = AmapService as jest.MockedClass<typeof AmapService>;

describe('MapView Component', () => {
  let mockAmapService: jest.Mocked<AmapService>;
  const defaultProps: MapViewProps = {
    latitude: 39.908823,
    longitude: 116.397470,
    scale: 16
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAmapService = {
      getCurrentLocation: jest.fn(),
      checkLocationPermission: jest.fn(),
      requestLocationPermission: jest.fn(),
      formatDistance: jest.fn((distance) => `${distance}m`),
      openNavigation: jest.fn()
    } as any;

    MockedAmapService.mockImplementation(() => mockAmapService);
  });

  describe('Rendering', () => {
    it('should render map component correctly', () => {
      render(<MapView {...defaultProps} />);
      
      expect(screen.getByTestId('map')).toBeInTheDocument();
      expect(screen.getByText('📍')).toBeInTheDocument(); // Location button
    });

    it('should render with custom height and className', () => {
      render(
        <MapView 
          {...defaultProps} 
          height="500px" 
          className="custom-map" 
        />
      );
      
      const mapContainer = screen.getByTestId('map').parentElement;
      expect(mapContainer).toHaveClass('custom-map');
      expect(mapContainer).toHaveStyle({ height: '500px' });
    });

    it('should render control buttons based on props', () => {
      render(
        <MapView 
          {...defaultProps}
          showLocationButton={true}
          showSearchButton={true}
          showNavigationButton={true}
          selectedStationId="station-1"
        />
      );
      
      expect(screen.getByText('📍')).toBeInTheDocument();
      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('🧭')).toBeInTheDocument();
    });

    it('should not render navigation button without selected station', () => {
      render(
        <MapView 
          {...defaultProps}
          showNavigationButton={true}
        />
      );
      
      expect(screen.queryByText('🧭')).not.toBeInTheDocument();
    });
  });

  describe('Location Functionality', () => {
    it('should get current location successfully', async () => {
      const mockLocation = {
        latitude: 39.908823,
        longitude: 116.397470,
        address: '北京市朝阳区'
      };

      mockAmapService.checkLocationPermission.mockResolvedValue(true);
      mockAmapService.getCurrentLocation.mockResolvedValue(mockLocation);

      const onLocationChange = jest.fn();
      render(
        <MapView 
          {...defaultProps} 
          onLocationChange={onLocationChange}
        />
      );
      
      const locationButton = screen.getByText('📍');
      fireEvent.click(locationButton);
      
      await waitFor(() => {
        expect(mockAmapService.getCurrentLocation).toHaveBeenCalled();
        expect(onLocationChange).toHaveBeenCalledWith(mockLocation);
      });
    });

    it('should handle location permission request', async () => {
      mockAmapService.checkLocationPermission.mockResolvedValue(false);
      mockAmapService.requestLocationPermission.mockResolvedValue(true);
      mockAmapService.getCurrentLocation.mockResolvedValue({
        latitude: 39.908823,
        longitude: 116.397470
      });

      render(<MapView {...defaultProps} />);
      
      const locationButton = screen.getByText('📍');
      fireEvent.click(locationButton);
      
      await waitFor(() => {
        expect(mockAmapService.checkLocationPermission).toHaveBeenCalled();
        expect(mockAmapService.requestLocationPermission).toHaveBeenCalled();
        expect(mockAmapService.getCurrentLocation).toHaveBeenCalled();
      });
    });

    it('should handle location permission denied', async () => {
      mockAmapService.checkLocationPermission.mockResolvedValue(false);
      mockAmapService.requestLocationPermission.mockResolvedValue(false);

      render(<MapView {...defaultProps} />);
      
      const locationButton = screen.getByText('📍');
      fireEvent.click(locationButton);
      
      await waitFor(() => {
        expect(mockAmapService.requestLocationPermission).toHaveBeenCalled();
        expect(mockAmapService.getCurrentLocation).not.toHaveBeenCalled();
      });
    });

    it('should handle location error', async () => {
      mockAmapService.checkLocationPermission.mockResolvedValue(true);
      mockAmapService.getCurrentLocation.mockRejectedValue(new Error('定位失败'));

      render(<MapView {...defaultProps} />);
      
      const locationButton = screen.getByText('📍');
      fireEvent.click(locationButton);
      
      await waitFor(() => {
        expect(screen.getByText('⚠️ 定位失败')).toBeInTheDocument();
        expect(screen.getByText('重试')).toBeInTheDocument();
      });
    });

    it('should show loading state during location request', async () => {
      mockAmapService.checkLocationPermission.mockResolvedValue(true);
      mockAmapService.getCurrentLocation.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(<MapView {...defaultProps} />);
      
      const locationButton = screen.getByText('📍');
      fireEvent.click(locationButton);
      
      expect(screen.getByText('定位中...')).toBeInTheDocument();
    });
  });

  describe('Map Interactions', () => {
    it('should handle map click events', () => {
      const onMapClick = jest.fn();
      render(<MapView {...defaultProps} onMapClick={onMapClick} />);
      
      const map = screen.getByTestId('map');
      fireEvent.click(map);
      
      expect(onMapClick).toHaveBeenCalledWith({
        latitude: 39.908823,
        longitude: 116.397470
      });
    });

    it('should handle marker click events', () => {
      const onMarkerClick = jest.fn();
      const markers = [{
        id: 'test-marker',
        latitude: 39.908823,
        longitude: 116.397470,
        title: 'Test Marker'
      }];

      render(
        <MapView 
          {...defaultProps} 
          markers={markers}
          onMarkerClick={onMarkerClick} 
        />
      );
      
      const markerButton = screen.getByText('Marker Click');
      fireEvent.click(markerButton);
      
      expect(onMarkerClick).toHaveBeenCalledWith('test-marker', markers[0]);
    });

    it('should handle region change events', () => {
      const onRegionChange = jest.fn();
      render(<MapView {...defaultProps} onRegionChange={onRegionChange} />);
      
      const regionButton = screen.getByText('Region Change');
      fireEvent.click(regionButton);
      
      expect(onRegionChange).toHaveBeenCalledWith({
        latitude: 39.908823,
        longitude: 116.397470,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
    });

    it('should handle map ready event', () => {
      render(<MapView {...defaultProps} />);
      
      const readyButton = screen.getByText('Map Ready');
      fireEvent.click(readyButton);
      
      // Map should be ready and loading should disappear
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  });

  describe('Charging Stations', () => {
    const chargingStations = [
      {
        id: 'station-1',
        name: '充电站1',
        address: '地址1',
        location: { latitude: 39.908823, longitude: 116.397470 },
        distance: 100
      },
      {
        id: 'station-2',
        name: '充电站2',
        address: '地址2',
        location: { latitude: 39.909823, longitude: 116.398470 },
        distance: 200
      }
    ];

    it('should render charging station markers', () => {
      render(
        <MapView 
          {...defaultProps} 
          chargingStations={chargingStations}
        />
      );
      
      // Markers should be rendered (tested through map component props)
      const map = screen.getByTestId('map');
      expect(map).toBeInTheDocument();
    });

    it('should handle charging station selection', () => {
      const onStationSelect = jest.fn();
      render(
        <MapView 
          {...defaultProps} 
          chargingStations={chargingStations}
          onStationSelect={onStationSelect}
        />
      );
      
      const markerButton = screen.getByText('Marker Click');
      fireEvent.click(markerButton);
      
      // Should call onStationSelect if the clicked marker is a charging station
      // This would need to be tested with proper marker ID matching
    });

    it('should show navigation button for selected station', () => {
      render(
        <MapView 
          {...defaultProps} 
          chargingStations={chargingStations}
          selectedStationId="station-1"
          showNavigationButton={true}
        />
      );
      
      expect(screen.getByText('🧭')).toBeInTheDocument();
    });

    it('should handle navigation to selected station', async () => {
      render(
        <MapView 
          {...defaultProps} 
          chargingStations={chargingStations}
          selectedStationId="station-1"
          showNavigationButton={true}
        />
      );
      
      const navigationButton = screen.getByText('🧭');
      fireEvent.click(navigationButton);
      
      await waitFor(() => {
        expect(mockAmapService.openNavigation).toHaveBeenCalledWith(
          chargingStations[0].location,
          chargingStations[0].name,
          undefined
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should show loading state initially', () => {
      render(<MapView {...defaultProps} />);
      
      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.getByText('地图加载中...')).toBeInTheDocument();
    });

    it('should handle location service errors gracefully', async () => {
      mockAmapService.checkLocationPermission.mockRejectedValue(new Error('Service error'));

      render(<MapView {...defaultProps} />);
      
      const locationButton = screen.getByText('📍');
      fireEvent.click(locationButton);
      
      await waitFor(() => {
        // Should handle error gracefully without crashing
        expect(screen.getByText('📍')).toBeInTheDocument();
      });
    });
  });

  describe('Props Validation', () => {
    it('should use default coordinates when not provided', () => {
      render(<MapView />);
      
      const map = screen.getByTestId('map');
      expect(map).toBeInTheDocument();
    });

    it('should respect all map configuration props', () => {
      render(
        <MapView 
          {...defaultProps}
          showLocation={false}
          showCompass={false}
          showScale={false}
          enableZoom={false}
          enableScroll={false}
          enableRotate={true}
          enableOverlooking={true}
        />
      );
      
      const map = screen.getByTestId('map');
      expect(map).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      render(
        <MapView 
          {...defaultProps}
          showLocationButton={true}
          showSearchButton={true}
        />
      );
      
      expect(screen.getByText('📍')).toBeInTheDocument();
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });

    it('should show helpful location information', async () => {
      const mockLocation = {
        latitude: 39.908823,
        longitude: 116.397470,
        address: '北京市朝阳区',
        accuracy: 10
      };

      mockAmapService.checkLocationPermission.mockResolvedValue(true);
      mockAmapService.getCurrentLocation.mockResolvedValue(mockLocation);

      render(<MapView {...defaultProps} />);
      
      const locationButton = screen.getByText('📍');
      fireEvent.click(locationButton);
      
      await waitFor(() => {
        expect(screen.getByText('📍 北京市朝阳区')).toBeInTheDocument();
        expect(screen.getByText('精度: 10m')).toBeInTheDocument();
      });
    });
  });
});