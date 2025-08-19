import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { TaroSafe } from '../../utils/taroSafe';
import { 
  SearchBar, 
  Cell, 
  Button as NutButton, 
  Loading, 
  Empty,
  Tag,
  Popup
} from '@nutui/nutui-react-taro';
import AmapService, { SearchResult, LocationInfo } from '../../services/AmapService';
import './index.scss';

export interface MapSearchProps {
  visible?: boolean;
  onClose?: () => void;
  onResultSelect?: (result: SearchResult) => void;
  currentLocation?: LocationInfo | null;
  searchTypes?: string[];
  placeholder?: string;
  maxResults?: number;
  searchRadius?: number;
}

interface SearchState {
  keyword: string;
  results: SearchResult[];
  isSearching: boolean;
  searchHistory: string[];
  selectedType: string;
  hasSearched: boolean;
}

const MapSearch: React.FC<MapSearchProps> = ({
  visible = false,
  onClose,
  onResultSelect,
  currentLocation,
  searchTypes = ['充电站', '加油站', '停车场', '商场', '医院', '银行'],
  placeholder = '搜索地点、充电站等',
  maxResults = 20,
  searchRadius = 5000
}) => {
  const [searchState, setSearchState] = useState<SearchState>({
    keyword: '',
    results: [],
    isSearching: false,
    searchHistory: [],
    selectedType: '',
    hasSearched: false
  });

  const amapService = useRef(new AmapService());
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // 从本地存储加载搜索历史
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const history = await TaroSafe.getStorageSync('map_search_history');
        if (history && Array.isArray(history)) {
          setSearchState(prev => ({
            ...prev,
            searchHistory: history.slice(0, 10) // 最多保存10条
          }));
        }
      } catch (error) {
        console.warn('⚠️ 加载搜索历史失败:', error);
      }
    };

    if (visible) {
      loadSearchHistory();
    }
  }, [visible]);

  // 保存搜索历史到本地存储
  const saveSearchHistory = useCallback(async (keyword: string) => {
    try {
      const newHistory = [keyword, ...searchState.searchHistory.filter(item => item !== keyword)];
      const limitedHistory = newHistory.slice(0, 10);
      
      await TaroSafe.setStorageSync('map_search_history', limitedHistory);
      setSearchState(prev => ({
        ...prev,
        searchHistory: limitedHistory
      }));
    } catch (error) {
      console.warn('⚠️ 保存搜索历史失败:', error);
    }
  }, [searchState.searchHistory]);

  // 执行搜索
  const performSearch = useCallback(async (keyword: string, type?: string) => {
    if (!keyword.trim()) {
      return;
    }

    setSearchState(prev => ({
      ...prev,
      isSearching: true,
      hasSearched: true
    }));

    try {
      let results: SearchResult[] = [];

      if (currentLocation) {
        // 如果有当前位置，进行周边搜索
        results = await amapService.current.searchNearby(
          {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
          },
          keyword,
          {
            radius: searchRadius,
            pageSize: maxResults,
            types: type ? getSearchTypeCode(type) : undefined
          }
        );
      } else {
        // 否则进行普通POI搜索
        results = await amapService.current.searchPOI(
          keyword,
          undefined,
          {
            pageSize: maxResults,
            types: type ? getSearchTypeCode(type) : undefined
          }
        );
      }

      // 如果有当前位置，计算距离
      if (currentLocation) {
        results = results.map(result => ({
          ...result,
          distance: amapService.current.calculateDistance(
            currentLocation,
            result.location
          )
        }));

        // 按距离排序
        results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      setSearchState(prev => ({
        ...prev,
        results,
        isSearching: false
      }));

      // 保存搜索历史
      await saveSearchHistory(keyword);

    } catch (error: any) {
      console.error('❌ 搜索失败:', error);
      setSearchState(prev => ({
        ...prev,
        results: [],
        isSearching: false
      }));

      TaroSafe.showToast({
        title: error.message || '搜索失败',
        icon: 'none',
        duration: 2000
      });
    }
  }, [currentLocation, searchRadius, maxResults, saveSearchHistory]);

  // 获取搜索类型对应的POI类型代码
  const getSearchTypeCode = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      '充电站': '010000|020000', // 汽车服务相关
      '加油站': '010100',
      '停车场': '150700',
      '商场': '060000',
      '医院': '090100',
      '银行': '160000',
      '餐厅': '050000',
      '酒店': '100000'
    };
    return typeMap[type] || '';
  };

  // 防抖搜索
  const handleSearchChange = useCallback((value: string) => {
    setSearchState(prev => ({ ...prev, keyword: value }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value, searchState.selectedType);
      }, 500);
    } else {
      setSearchState(prev => ({
        ...prev,
        results: [],
        hasSearched: false
      }));
    }
  }, [performSearch, searchState.selectedType]);

  // 搜索确认
  const handleSearchConfirm = useCallback(() => {
    if (searchState.keyword.trim()) {
      performSearch(searchState.keyword, searchState.selectedType);
    }
  }, [searchState.keyword, searchState.selectedType, performSearch]);

  // 选择搜索类型
  const handleTypeSelect = useCallback((type: string) => {
    const newType = searchState.selectedType === type ? '' : type;
    setSearchState(prev => ({ ...prev, selectedType: newType }));

    if (searchState.keyword.trim()) {
      performSearch(searchState.keyword, newType);
    }
  }, [searchState.selectedType, searchState.keyword, performSearch]);

  // 选择搜索结果
  const handleResultSelect = useCallback((result: SearchResult) => {
    onResultSelect?.(result);
    onClose?.();
  }, [onResultSelect, onClose]);

  // 选择历史记录
  const handleHistorySelect = useCallback((keyword: string) => {
    setSearchState(prev => ({ ...prev, keyword }));
    performSearch(keyword, searchState.selectedType);
  }, [performSearch, searchState.selectedType]);

  // 清除搜索历史
  const clearSearchHistory = useCallback(async () => {
    try {
      await TaroSafe.removeStorageSync('map_search_history');
      setSearchState(prev => ({ ...prev, searchHistory: [] }));
      
      TaroSafe.showToast({
        title: '已清除搜索历史',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.warn('⚠️ 清除搜索历史失败:', error);
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Popup
      visible={visible}
      position="top"
      closeable
      onClose={onClose}
      className="map-search-popup"
    >
      <View className="map-search">
        {/* 搜索栏 */}
        <View className="map-search__header">
          <SearchBar
            value={searchState.keyword}
            placeholder={placeholder}
            onSearch={handleSearchConfirm}
            onChange={handleSearchChange}
            className="search-bar"
          />
        </View>

        {/* 搜索类型 */}
        <View className="map-search__types">
          <ScrollView scrollX className="types-scroll">
            <View className="types-list">
              {searchTypes.map(type => (
                <Tag
                  key={type}
                  type={searchState.selectedType === type ? 'primary' : 'default'}
                  size="small"
                  onClick={() => handleTypeSelect(type)}
                  className="type-tag"
                >
                  {type}
                </Tag>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 搜索内容 */}
        <View className="map-search__content">
          {searchState.isSearching ? (
            // 搜索中
            <View className="search-loading">
              <Loading type="spinner" />
              <Text className="loading-text">搜索中...</Text>
            </View>
          ) : searchState.hasSearched ? (
            // 搜索结果
            searchState.results.length > 0 ? (
              <ScrollView className="search-results" scrollY>
                {searchState.results.map(result => (
                  <Cell
                    key={result.id}
                    title={result.name}
                    desc={result.address}
                    extra={
                      <View className="result-extra">
                        {result.distance && (
                          <Text className="distance">
                            {amapService.current.formatDistance(result.distance)}
                          </Text>
                        )}
                        {result.type && (
                          <Tag size="mini" className="type-tag">
                            {result.type}
                          </Tag>
                        )}
                      </View>
                    }
                    onClick={() => handleResultSelect(result)}
                    className="result-item"
                  />
                ))}
              </ScrollView>
            ) : (
              // 无搜索结果
              <Empty
                description="未找到相关地点"
                imageSize={80}
                className="search-empty"
              />
            )
          ) : (
            // 搜索历史
            <View className="search-history">
              {searchState.searchHistory.length > 0 && (
                <>
                  <View className="history-header">
                    <Text className="history-title">搜索历史</Text>
                    <NutButton
                      type="default"
                      size="mini"
                      onClick={clearSearchHistory}
                      className="clear-btn"
                    >
                      清除
                    </NutButton>
                  </View>
                  <View className="history-list">
                    {searchState.searchHistory.map((keyword, index) => (
                      <View
                        key={index}
                        className="history-item"
                        onClick={() => handleHistorySelect(keyword)}
                      >
                        <Text className="history-keyword">🕐 {keyword}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* 热门搜索 */}
              <View className="hot-searches">
                <Text className="hot-title">热门搜索</Text>
                <View className="hot-list">
                  {['充电站', '特斯拉超充', '国家电网', '星星充电', '小鹏超充'].map(keyword => (
                    <Tag
                      key={keyword}
                      type="default"
                      size="small"
                      onClick={() => handleHistorySelect(keyword)}
                      className="hot-tag"
                    >
                      {keyword}
                    </Tag>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 位置提示 */}
        {!currentLocation && (
          <View className="map-search__tip">
            <Text className="tip-text">
              💡 开启定位后可搜索附近地点并显示距离
            </Text>
          </View>
        )}
      </View>
    </Popup>
  );
};

export default MapSearch;