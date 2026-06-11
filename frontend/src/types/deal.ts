export interface Deal {
  productCode: string;
  title: string;
  brand: string;
  price: string;
  discount: string;
  mrp: string;
  photo: string;
  productUrl: string;
  storeType: string;
  categoryGroup?: string;
  category?: {
    mainCategory?: string;
    c1?: string;
    c2?: string;
    c3?: string;
    c4?: string;
    c5?: string;
  };
  notificationStatus?: NotificationStatus;
  [key: string]: any;
}

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


















