import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignIn from './SignIn';
import StaffManage from './StaffManage';
import Principal from './Principal';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/manage" element={<StaffManage />} />
        <Route path="/principal" element={<Principal />} />
      </Routes>
    </Router>
  );
}
