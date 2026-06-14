import React, { useState, useEffect, useMemo } from 'react';
import { categoriesAPI } from '../services/api';

interface CategoryMatcherProps {
  productData: any;
  onChange: (field: string, value: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

const CategoryMatcher: React.FC<CategoryMatcherProps> = ({ productData, onChange, onSave, isSaving }) => {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Custom states
  const [customCategoryGroup, setCustomCategoryGroup] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customSubCategory, setCustomSubCategory] = useState('');
  
  // Track if "Custom" is selected
  const [isCustomCategoryGroup, setIsCustomCategoryGroup] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomSubCategory, setIsCustomSubCategory] = useState(false);

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const response = await categoriesAPI.getHierarchy();
        if (response.data?.success) {
          setHierarchy(response.data.data);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHierarchy();
  }, []);

  // Compute lists based on current selection
  const mainCategories = useMemo(() => {
    if (!hierarchy) return [];
    return Object.values(hierarchy).map((cat: any) => cat.name);
  }, [hierarchy]);

  const subCategories = useMemo(() => {
    if (!hierarchy || !productData.categoryGroup) return [];
    const mainCat = Object.values(hierarchy).find((cat: any) => cat.name === productData.categoryGroup) as any;
    if (!mainCat || !mainCat.subcategories) return [];
    return Object.values(mainCat.subcategories).map((sub: any) => sub.name);
  }, [hierarchy, productData.categoryGroup]);

  const styles = useMemo(() => {
    if (!hierarchy || !productData.categoryGroup || !productData.category) return [];
    const mainCat = Object.values(hierarchy).find((cat: any) => cat.name === productData.categoryGroup) as any;
    if (!mainCat || !mainCat.subcategories) return [];
    const subCat = Object.values(mainCat.subcategories).find((sub: any) => sub.name === productData.category) as any;
    if (!subCat || !subCat.styles) return [];
    return Object.values(subCat.styles);
  }, [hierarchy, productData.categoryGroup, productData.category]);

  if (loading) return <div>Loading categories...</div>;

  const handleSelectChange = (field: string, value: string, setIsCustom: (val: boolean) => void, setCustomVal: (val: string) => void) => {
    if (value === 'CUSTOM_VALUE') {
      setIsCustom(true);
      setCustomVal('');
      onChange(field, ''); // Clear the main product field until they type
    } else {
      setIsCustom(false);
      onChange(field, value);
    }
  };

  const handleCustomTextChange = (field: string, value: string, setCustomVal: (val: string) => void) => {
    setCustomVal(value);
    onChange(field, value);
  };

  const selectStyle = {
    width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '8px'
  };

  return (
    <div style={{ padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '15px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Category Matching Center</h3>
      
      {/* Category Group (Main Category) */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Main Category (categoryGroup)</label>
        <select 
          value={isCustomCategoryGroup ? 'CUSTOM_VALUE' : (mainCategories.includes(productData.categoryGroup) ? productData.categoryGroup : (productData.categoryGroup ? 'CUSTOM_VALUE' : ''))} 
          onChange={(e) => handleSelectChange('categoryGroup', e.target.value, setIsCustomCategoryGroup, setCustomCategoryGroup)}
          style={selectStyle}
        >
          <option value="">-- Select Main Category --</option>
          {mainCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
          <option value="CUSTOM_VALUE">-- Add Custom Category --</option>
        </select>
        {(isCustomCategoryGroup || (productData.categoryGroup && !mainCategories.includes(productData.categoryGroup))) && (
          <input 
            type="text" 
            placeholder="Type custom main category"
            value={productData.categoryGroup || customCategoryGroup}
            onChange={(e) => handleCustomTextChange('categoryGroup', e.target.value, setCustomCategoryGroup)}
            style={selectStyle}
          />
        )}
      </div>

      {/* Category (Sub Category) */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Sub Category (category)</label>
        <select 
          value={isCustomCategory ? 'CUSTOM_VALUE' : (subCategories.includes(productData.category) ? productData.category : (productData.category ? 'CUSTOM_VALUE' : ''))} 
          onChange={(e) => handleSelectChange('category', e.target.value, setIsCustomCategory, setCustomCategory)}
          style={selectStyle}
        >
          <option value="">-- Select Sub Category --</option>
          {subCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
          <option value="CUSTOM_VALUE">-- Add Custom Sub Category --</option>
        </select>
        {(isCustomCategory || (productData.category && !subCategories.includes(productData.category))) && (
          <input 
            type="text" 
            placeholder="Type custom sub category"
            value={productData.category || customCategory}
            onChange={(e) => handleCustomTextChange('category', e.target.value, setCustomCategory)}
            style={selectStyle}
          />
        )}
      </div>

      {/* Style / Mixed Categories */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Style / Mixed (subCategory & style)</label>
        <select 
          value={isCustomSubCategory ? 'CUSTOM_VALUE' : (styles.includes(productData.subCategory) ? productData.subCategory : (productData.subCategory ? 'CUSTOM_VALUE' : ''))} 
          onChange={(e) => {
            const val = e.target.value;
            handleSelectChange('subCategory', val, setIsCustomSubCategory, setCustomSubCategory);
            // Also map it to style if it's not custom
            if (val !== 'CUSTOM_VALUE') {
              onChange('style', val);
            }
          }}
          style={selectStyle}
        >
          <option value="">-- Select Style --</option>
          {styles.map((style: any) => <option key={style as string} value={style as string}>{style as string}</option>)}
          <option value="CUSTOM_VALUE">-- Add Custom Style --</option>
        </select>
        {(isCustomSubCategory || (productData.subCategory && !styles.includes(productData.subCategory))) && (
          <input 
            type="text" 
            placeholder="Type custom style"
            value={productData.subCategory || customSubCategory}
            onChange={(e) => {
              handleCustomTextChange('subCategory', e.target.value, setCustomSubCategory);
              onChange('style', e.target.value);
            }}
            style={selectStyle}
          />
        )}
      </div>

      {onSave && (
        <div style={{ marginTop: '15px' }}>
          <button 
            onClick={onSave}
            disabled={isSaving}
            style={{
              padding: '10px 15px',
              backgroundColor: isSaving ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            {isSaving ? 'Saving...' : 'Submit Categories'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CategoryMatcher;
