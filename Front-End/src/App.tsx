import CustomerApp from './customer/CustomerApp';
import AdminApp from './admin/AdminApp';
import { isAdminApp } from './config/appConfig';

export default function App() {
  return isAdminApp ? <AdminApp /> : <CustomerApp />;
}
