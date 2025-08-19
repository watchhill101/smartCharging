import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StationSearch, { StationSearchProps, SearchResult } from '../index';

// Mock Taro APIs
jest.mock('@tarojs/taro', () => ({
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn()
}));

// Mock NutUI components
jest.mock('@nutui/nutui-react-taro', () => ({
  SearchBar: ({ value, onChange, onSearch, placeholder }: any) => (
    <input
      data-testid="search-bar"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && onSearch?.()}
      placeholder={placeholder}
    />
  ),
  Button: ({ children, onClick, type, size, className }: any) => (
    <button onClick={onClick} className={`${type} ${size} ${className}`}>
      {children}
    </button>
  ),
  Tag: ({ children, onClick, type, size, className }: any) => (
    <span onClick={onClick} className={`tag ${type} ${size} ${className}`}>
      {children}
    </span>
  ),
  Popup: ({ children, visible, onClose }: any) => 
    visible ? (
      <div data-testid="popup">
        <button onClick={onClose} data-testid="close-btn">Close</button>
        {children}
      </div>
    ) : null,
  Cell: ({ title, desc, onClick }: any) => (
    <div onClick={onClick} data-testid="cell">
      <div>{title}</div>
      <div>{desc}</div>
    </div>
  ),
  Loading: () => <div data-testid="loading">Loading...</div>,
  Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
  Range: ({ value, onChange, min, max }: any) => (
    <input
      data-testid="range"
      type="range"
      value={Array.isArray(value) ? value[0] : value}
      onChange={(e) => onChange?.([parseInt(e.target.value)])}
      min={min}
      max={max}
    />
  ),
  RadioGroup: ({ children, value, onChange }: any) => (
    <div data-testid="radio-group" data-value={value}>
      {React.Children.map(children, (child, index) => 
        React.cloneElement(child, { 
          key: index,
          checked: child.props.value === value,
          onChange: () => onChange?.(child.props.value)
        })
      )}
    </div>
  ),
  Radio: ({ children, value, checked, onChange }: any) => (
    <label>
      <input
        type="radio"
        value={value}
        checked={checked}
        onChange={onChange}
      />
      {children}
    </label>
  ),
  CheckboxGroup: ({ children, value = [], onChange }: any) => (
    <div data-testid="checkbox-group">
      {React.Children.map(children, (child, index) => 
        React.cloneElement(child, { 
          key: index,
          checked: value.includes(child.props.value),
          onChange: (checked: boolean) => {
            const newValue = checked 
              ? [...value, child.props.value]
              : value.filter((v: any) => v !== child.props.value);
            onChange?.(newValue);
          }
        })
      )}
    </div>
  ),
  Checkbox: ({ children, value, checked, onChange }: any) => (
    <label>
      <input
        type="checkbox"
        value={value}
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {children}
    </label>
  ),
  Divider: () => <hr data-testid="divider" />,
  Toast: {
    show: jest.fn()
  }
}));

// Mock Taro components
jest.mock('@tarojs/components', () => ({
  View: ({ children, className, onClick }: any) => (
    <div className={className} onClick={onClick}>{children}</div>
  ),
  Text: ({ children, className }: any) => (
    <span className={className}>{children}</span>
  ),
  ScrollView: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  )
}));

describe('StationSearch Component', () => {
  const mockSearchResults: SearchResult[] = [
    {
      id: '1',
      stationId: 'STATION_001',
      name: '测试充电站1',
      address: '北京市朝阳区测试路1号',
      location: { latitude: 39.908823, longitude: 116.397470 },
      distance: 1000,
      operator: { name: '测试运营商' },
      totalPiles: 10,
      availablePiles: 8,
      rating: { average: 4.5, count: 100 },
      priceRange: { minServicePrice: 0.5, maxServicePrice: 0.8 },
      services: ['parking', 'wifi', 'restaurant']
    },
    {
      id: '2',
      stationId: 'STATION_002',
      name: '测试充电站2',
      address: '北京市朝阳区测试路2号',
      location: { latitude: 39.918823, longitude: 116.407470 },
      distance: 2000,
      operator: { name: '另一个运营商' },
      totalPiles: 6,
      availablePiles: 4,
      rating: { average: 4.2, count: 50 },
      priceRange: { minServicePrice: 0.6, maxServicePrice: 0.9 },
      services: ['parking', 'restroom']
    }
  ];

  const defaultProps: StationSearchProps = {
    visible: true,
    onClose: jest.fn(),
    onSearch: jest.fn(),
    onResultSelect: jest.fn(),
    results: mockSearchResults,
    total: 2,
    loading: false,
    hasMore: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render search component when visible', () => {
      render(<StationSearch {...defaultProps} />);
      
      expect(screen.getByTestId('popup')).toBeInTheDocument();
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
      expect(screen.getByText('筛选')).toBeInTheDocument();
    });

    it('should not render when not visible', () => {
      render(<StationSearch {...defaultProps} visible={false} />);
      
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    it('should render search results', () => {
      render(<StationSearch {...defaultProps} />);
      
      expect(screen.getByText('测试充电站1')).toBeInTheDocument();
      expect(screen.getByText('测试充电站2')).toBeInTheDocument();
      expect(screen.getByText('找到 2 个充电站')).toBeInTheDocument();
    });

    it('should render quick filter tags', () => {
      render(<StationSearch {...defaultProps} />);
      
      expect(screen.getByText('附近可用')).toBeInTheDocument();
      expect(screen.getByText('快充站')).toBeInTheDocument();
      expect(screen.getByText('高评分')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should handle search input changes', async () => {
      const onSearch = jest.fn();
      render(<StationSearch {...defaultProps} onSearch={onSearch} />);
      
      const searchBar = screen.getByTestId('search-bar');
      fireEvent.change(searchBar, { target: { value: '测试充电站' } });
      
      // Wait for debounced search
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            keyword: '测试充电站'
          }),
          expect.any(Object)
        );
      }, { timeout: 1000 });
    });

    it('should handle search confirmation', () => {
      const onSearch = jest.fn();
      render(<StationSearch {...defaultProps} onSearch={onSearch} />);
      
      const searchBar = screen.getByTestId('search-bar');
      fireEvent.change(searchBar, { target: { value: '测试' } });
      fireEvent.keyPress(searchBar, { key: 'Enter' });
      
      expect(onSearch).toHaveBeenCalled();
    });

    it('should apply quick filters', () => {
      const onSearch = jest.fn();
      render(<StationSearch {...defaultProps} onSearch={onSearch} />);
      
      fireEvent.click(screen.getByText('附近可用'));
      
      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          availability: 'available',
          distance: 3000
        }),
        expect.any(Object)
      );
    });
  });

  describe('Filter Panel', () => {
    it('should show/hide filter panel', () => {
      render(<StationSearch {...defaultProps} />);
      
      const filterBtn = screen.getByText('筛选');
      fireEvent.click(filterBtn);
      
      expect(screen.getByText('可用性')).toBeInTheDocument();
      expect(screen.getByText('运营商')).toBeInTheDocument();
    });

    it('should update availability filter', () => {
      render(<StationSearch {...defaultProps} />);
      
      // Open filter panel
      fireEvent.click(screen.getByText('筛选'));
      
      // Change availability filter
      const radioGroup = screen.getByTestId('radio-group');
      const allRadio = screen.getByDisplayValue('all');
      fireEvent.click(allRadio);
      
      // Apply filters
      fireEvent.click(screen.getByText('应用筛选'));
      
      expect(defaultProps.onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          availability: 'all'
        }),
        expect.any(Object)
      );
    });

    it('should update connector type filter', () => {
      render(<StationSearch {...defaultProps} />);
      
      // Open filter panel
      fireEvent.click(screen.getByText('筛选'));
      
      // Select connector types
      const gbTCheckbox = screen.getByDisplayValue('GB/T');
      fireEvent.click(gbTCheckbox);
      
      // Apply filters
      fireEvent.click(screen.getByText('应用筛选'));
      
      expect(defaultProps.onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorType: ['GB/T']
        }),
        expect.any(Object)
      );
    });

    it('should reset filters', () => {
      render(<StationSearch {...defaultProps} />);
      
      // Open filter panel
      fireEvent.click(screen.getByText('筛选'));
      
      // Reset filters
      fireEvent.click(screen.getByText('重置'));
      
      // Apply filters
      fireEvent.click(screen.getByText('应用筛选'));
      
      expect(defaultProps.onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          availability: 'available',
          distance: 5000
        }),
        expect.any(Object)
      );
    });
  });

  describe('Search Results', () => {
    it('should handle result selection', () => {
      const onResultSelect = jest.fn();
      render(<StationSearch {...defaultProps} onResultSelect={onResultSelect} />);
      
      fireEvent.click(screen.getByText('测试充电站1'));
      
      expect(onResultSelect).toHaveBeenCalledWith(mockSearchResults[0]);
    });

    it('should show loading state', () => {
      render(<StationSearch {...defaultProps} loading={true} results={[]} />);
      
      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.getByText('搜索中...')).toBeInTheDocument();
    });

    it('should show empty state', () => {
      render(<StationSearch {...defaultProps} results={[]} />);
      
      expect(screen.getByTestId('empty')).toBeInTheDocument();
      expect(screen.getByText('未找到符合条件的充电站')).toBeInTheDocument();
    });

    it('should handle load more', () => {
      const onLoadMore = jest.fn();
      render(<StationSearch {...defaultProps} hasMore={true} onLoadMore={onLoadMore} />);
      
      fireEvent.click(screen.getByText('加载更多'));
      
      expect(onLoadMore).toHaveBeenCalled();
    });
  });

  describe('Sorting', () => {
    it('should handle sort by distance', () => {
      const onSearch = jest.fn();
      render(<StationSearch {...defaultProps} onSearch={onSearch} />);
      
      fireEvent.click(screen.getByText('距离'));
      
      expect(onSearch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          sortBy: 'distance',
          sortOrder: 'asc'
        })
      );
    });

    it('should handle sort by rating', () => {
      const onSearch = jest.fn();
      render(<StationSearch {...defaultProps} onSearch={onSearch} />);
      
      fireEvent.click(screen.getByText('评分'));
      
      expect(onSearch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          sortBy: 'rating',
          sortOrder: 'desc'
        })
      );
    });

    it('should handle sort by price', () => {
      const onSearch = jest.fn();
      render(<StationSearch {...defaultProps} onSearch={onSearch} />);
      
      fireEvent.click(screen.getByText('价格'));
      
      expect(onSearch).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          sortBy: 'price',
          sortOrder: 'asc'
        })
      );
    });
  });

  describe('Search History', () => {
    it('should load search history from storage', async () => {
      const { getStorageSync } = require('@tarojs/taro');
      getStorageSync.mockReturnValue(['历史搜索1', '历史搜索2']);
      
      render(<StationSearch {...defaultProps} results={[]} />);
      
      await waitFor(() => {
        expect(screen.getByText('历史搜索1')).toBeInTheDocument();
        expect(screen.getByText('历史搜索2')).toBeInTheDocument();
      });
    });

    it('should clear search history', async () => {
      const { getStorageSync, removeStorageSync } = require('@tarojs/taro');
      getStorageSync.mockReturnValue(['历史搜索1']);
      
      render(<StationSearch {...defaultProps} results={[]} />);
      
      await waitFor(() => {
        expect(screen.getByText('历史搜索1')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('清除'));
      
      expect(removeStorageSync).toHaveBeenCalledWith('station_search_history');
    });

    it('should select from search history', async () => {
      const { getStorageSync } = require('@tarojs/taro');
      const onSearch = jest.fn();
      getStorageSync.mockReturnValue(['历史搜索']);
      
      render(<StationSearch {...defaultProps} onSearch={onSearch} results={[]} />);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('历史搜索'));
      });
      
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            keyword: '历史搜索'
          }),
          expect.any(Object)
        );
      }, { timeout: 1000 });
    });
  });

  describe('Location Integration', () => {
    it('should show distance filter when location is available', () => {
      const currentLocation = {
        latitude: 39.908823,
        longitude: 116.397470,
        city: '北京市'
      };
      
      render(<StationSearch {...defaultProps} currentLocation={currentLocation} />);
      
      // Open filter panel
      fireEvent.click(screen.getByText('筛选'));
      
      expect(screen.getByText(/搜索范围/)).toBeInTheDocument();
    });

    it('should show location tip when no location', () => {
      render(<StationSearch {...defaultProps} currentLocation={null} />);
      
      expect(screen.getByText(/开启定位后可搜索附近充电站/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const { getStorageSync } = require('@tarojs/taro');
      getStorageSync.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      // Should not crash
      render(<StationSearch {...defaultProps} />);
      
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper search input', () => {
      render(<StationSearch {...defaultProps} />);
      
      const searchBar = screen.getByTestId('search-bar');
      expect(searchBar).toHaveAttribute('placeholder', '搜索充电站名称、地址或运营商');
    });

    it('should show helpful search tips', () => {
      render(<StationSearch {...defaultProps} results={[]} />);
      
      expect(screen.getByText('搜索提示')).toBeInTheDocument();
      expect(screen.getByText('• 输入充电站名称、地址或运营商名称')).toBeInTheDocument();
    });
  });
});