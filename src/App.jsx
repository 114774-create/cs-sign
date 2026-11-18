import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignIn from './SignIn';
import StaffManage from './StaffManage';
import Principal from './Principal';
import PasswordGate from './PasswordGate';
import { AUTH_KEYS } from './settings';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route
          path="/manage"
          element={
            <PasswordGate storageKey={AUTH_KEYS.manage} title="簽到處管理">
              <StaffManage />
            </PasswordGate>
          }
        />
        <Route
          path="/principal"
          element={
            <PasswordGate storageKey={AUTH_KEYS.principal} title="校長查閱" remember>
              <Principal />
            </PasswordGate>
          }
        />
      </Routes>
    </Router>
  );
}
