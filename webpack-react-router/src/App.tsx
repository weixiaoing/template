import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { useAppSelector } from "./store/hook";
import { selectCurrentUsername } from "./store/slice/auth";

import Home from "./views/home";
import LoginPage from "./views/LoginPage";
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const username = useAppSelector(selectCurrentUsername);

  // if (!username) {
  //   return <Navigate to="/login" replace />;
  // }

  return children;
};

function App() {
  return (
    <Router>
      {/* <Navbar /> */}
      <div className="App">
        <Routes>
          <Route path="/login" element={<LoginPage />}></Route>
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Routes>
                  <Route path="/" element={<Home />} />
                </Routes>
              </ProtectedRoute>
            }
          ></Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
