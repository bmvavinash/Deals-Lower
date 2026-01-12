export interface NotificationStatus {
  productCode: string;
  dealType: 'hotDeal' | 'productDeal';
  sentTo: {
    telegram?: PlatformStatus;
    whatsapp?: PlatformStatus;
    facebook?: PlatformStatus;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlatformStatus {
  sent: boolean;
  timestamp: string | null;
  success: boolean;
  error: string | null;
}

export interface PlatformStats {
  telegram: PlatformCounts;
  whatsapp: PlatformCounts;
  facebook: PlatformCounts;
}

export interface PlatformCounts {
  total: number;
  success: number;
  failed: number;
}


















