import { Navigate, Route, Routes } from 'react-router-dom';
import LegacyPage from './components/LegacyPage.jsx';
import BrandStoryFrame from './routes/BrandStoryFrame.jsx';
import ProductDetail from './routes/ProductDetail.jsx';
import Admin from './routes/admin/Admin.jsx';

const routes = {
  home: '/react-pages/home.html',
  collections: '/collection.html',
  products: '/products/Catalogue.html',
  inspiration: '/inspiration/references.html',
  professionals: '/for-professionals.html',
  contact: '/about-us/contact.html',
  pointsSale: '/about-us/points-sale.html'
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LegacyPage source={routes.home} />} />
      <Route path="/collection" element={<LegacyPage source={routes.collections} />} />
      <Route path="/collection/*" element={<Navigate to="/collection" replace />} />
      <Route path="/products/Catalogue" element={<LegacyPage source={routes.products} />} />
      <Route path="/products/catalogue" element={<Navigate to="/products/Catalogue" replace />} />
      <Route path="/products/catalogue/*" element={<Navigate to="/products/Catalogue" replace />} />
      <Route path="/products/detail/*" element={<ProductDetail />} />
      <Route path="/inspiration/references" element={<LegacyPage source={routes.inspiration} />} />
      <Route path="/inspiration/*" element={<Navigate to="/inspiration/references" replace />} />
      <Route path="/for-professionals" element={<LegacyPage source={routes.professionals} />} />
      <Route path="/for-professionals/*" element={<Navigate to="/for-professionals" replace />} />
      <Route path="/about-us/brand-story" element={<BrandStoryFrame />} />
      <Route path="/about-us/contact" element={<LegacyPage source={routes.contact} />} />
      <Route path="/about-us/points-sale" element={<LegacyPage source={routes.pointsSale} />} />
      <Route path="/about-us/*" element={<Navigate to="/about-us/brand-story" replace />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
