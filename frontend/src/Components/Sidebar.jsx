// rohithsai2004/jcsbot/JCSBOT-c968a16baaf78ba3a848fd197258c78786a45076/frontend/src/Components/Sidebar.jsx
import { BsChatSquareText } from "react-icons/bs";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, History, Settings, LogOut, X } from "lucide-react";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/sessions', label: 'Chat History', icon: History },
  ];

  const bottomNavItems = [
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <div
        className={`fixed top-0 left-0 h-full bg-base-200 shadow-2xl z-[60] transition-transform duration-300 ease-in-out transform ${
          isOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-base-300/70 h-[69px]"> {/* Match Navbar height */}
            <Link to="/" className="flex items-center gap-2 group">
              <BsChatSquareText className="h-6 w-6 text-primary group-hover:animate-pulse-subtle" />
              <h1 className="text-xl font-bold text-content group-hover:text-primary transition-colors">JCS Assistant</h1>
            </Link>
            <button 
              onClick={toggleSidebar} 
              className="text-neutral-400 hover:text-primary hover:bg-primary/10 p-1 rounded-md md:hidden"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1.5">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={isOpen && window.innerWidth < 768 ? toggleSidebar : undefined}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                  isActive(item.path)
                    ? 'bg-primary text-white shadow-md hover:bg-primary-dark'
                    : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                }`}
              >
                <item.icon size={18} className={`mr-3 ${isActive(item.path) ? 'text-white' : 'text-neutral-400 group-hover:text-primary'}`} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-3 border-t border-base-300/70 space-y-1.5">
            {bottomNavItems.map(item => (
               <Link
                key={item.path}
                to={item.path}
                onClick={isOpen && window.innerWidth < 768 ? toggleSidebar : undefined}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                  isActive(item.path)
                    ? 'bg-primary text-white shadow-md hover:bg-primary-dark'
                    : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                }`}
              >
                <item.icon size={18} className={`mr-3 ${isActive(item.path) ? 'text-white' : 'text-neutral-400 group-hover:text-primary'}`} />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/20 hover:text-danger/80 transition-colors group"
            >
              <LogOut size={18} className="mr-3 text-danger/80 group-hover:text-danger" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
};

export default Sidebar;