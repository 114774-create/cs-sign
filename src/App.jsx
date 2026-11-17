import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Staff from './Staff';
import Principal from './Principal';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Staff />} />
        <Route path="/principal" element={<Principal />} />
      </Routes>
    </Router>
  );
}
