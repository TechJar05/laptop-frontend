// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AvatarPage from "./pages/AvatarPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AvatarPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
