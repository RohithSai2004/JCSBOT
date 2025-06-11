// frontend/src/Components/Navbar.jsx
import Logo from "../Assets/jaijcs.jpg";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FileText, X, Menu, LogOut, UserCircle, ChevronDown, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';

const Navbar = ({ isLoggedIn, username, handleLogout, toggleSidebar, activeDocuments = [], documentNames = {} }) => {
  const navigate = useNavigate();
  const [showDocuments, setShowDocuments] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const currentHour = new Date().getHours();
  let greeting = "Hello";
  if (currentHour < 12) greeting = "Good Morning";
  else if (currentHour < 18) greeting = "Good Afternoon";
  else greeting = "Good Evening";

  const documentCount = activeDocuments?.length || 0;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-trigger') && !event.target.closest('.dropdown-menu')) {
         setShowDocuments(false);
         setShowUserMenu(false);
      }
    };
    if (showDocuments || showUserMenu) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDocuments, showUserMenu]);

  // Navbar text/icon colors need to contrast with the page gradients
  // For dark gradients, light text is good. For light gradients, dark text.
  const navContentColor = theme === 'dark' ? 'text-dark-foreground/80 hover:text-dark-foreground' : 'text-light-foreground/80 hover:text-light-foreground';
  const navIconHoverBg = theme === 'dark' ? 'hover:bg-dark-muted/30' : 'hover:bg-light-muted/50';
  const navPrimaryAccent = theme === 'dark' ? 'text-dark-primary hover:text-dark-primary-light' : 'text-light-primary hover:text-light-primary-dark';
  const navAccentColor = theme === 'dark' ? 'text-dark-accent hover:text-dark-accent-light' : 'text-light-accent hover:text-light-accent-dark';


  return (
    // Navbar background is transparent to show the page gradient.
    // A subtle bottom border can help define its edge.
    <div className={`py-3 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50 
                   bg-transparent backdrop-blur-sm 
                   border-b ${theme === 'dark' ? 'border-dark-border/30' : 'border-light-border/30'}`}>
      {/* Left Side */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className={`${navContentColor} ${navIconHoverBg} p-2 rounded-md transition-colors`}
          aria-label="Toggle sidebar"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center cursor-pointer group" onClick={() => navigate('/dashboard')}>
          <div className="bg-white p-1 rounded-lg shadow-sm">
            <img src={Logo} alt="JCS AI Logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-md" />
          </div>
          {/* "JAI" text removed */}
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={toggleTheme} 
          className={`p-2 rounded-full transition-colors ${navIconHoverBg} ${navAccentColor}`} 
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {isLoggedIn ? (
          <>
            {documentCount > 0 && (
              <div className="relative dropdown-trigger" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowDocuments(s => !s)}
                  className={`flex items-center text-sm ${theme === 'dark' ? 'bg-dark-primary/20 hover:bg-dark-primary/30 text-dark-primary-light' : 'bg-light-primary/10 hover:bg-light-primary/20 text-light-primary-dark'} px-3 py-2 rounded-md transition-colors font-medium`}
                >
                  <FileText size={16} className="mr-1.5" />
                  <span>{documentCount} Doc{documentCount !== 1 ? 's' : ''}</span>
                  <ChevronDown size={16} className={`ml-1 transition-transform ${showDocuments ? 'rotate-180' : ''}`} />
                </button>
                {showDocuments && (
                  <div className={`dropdown-menu card absolute top-full right-0 mt-2 w-72 p-3 z-[70] origin-top-right animate-fade-in`}> {/* Use .card for themed bg */}
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-semibold text-card-foreground dark:text-dark-card-foreground">Active Documents</h3>
                      <button onClick={() => setShowDocuments(false)} className="text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground"><X size={16}/></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                      {activeDocuments.map((docHash) => (
                        <div key={docHash} className="flex items-center p-2 hover:bg-muted dark:hover:bg-dark-muted rounded-md">
                          <FileText size={16} className="text-light-primary dark:text-dark-primary mr-2 flex-shrink-0" />
                          <span className="text-xs text-card-foreground dark:text-dark-card-foreground truncate" title={documentNames[docHash] || `Document ID: ${docHash}`}>
                            {documentNames[docHash] || `Document ${docHash.substring(0, 8)}...`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="relative dropdown-trigger" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowUserMenu(s => !s)}
                className={`flex items-center gap-2 ${navContentColor} p-1 rounded-full`}
              >
                <UserCircle size={28} />
                <span className="hidden sm:inline text-sm font-medium">{username}</span>
                <ChevronDown size={16} className={`transition-transform hidden sm:inline ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>
              {showUserMenu && (
                <div className={`dropdown-menu card absolute top-full right-0 mt-2 w-56 py-2 z-[70] origin-top-right animate-fade-in`}> {/* Use .card */}
                  <div className="px-4 py-2 border-b border-border dark:border-dark-border">
                    <p className="text-sm font-medium text-card-foreground dark:text-dark-card-foreground truncate">{username}</p>
                    <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground">{greeting}</p>
                  </div>
                  <nav className="mt-1">
                    <a
                      href="/settings"
                      onClick={(e) => { e.preventDefault(); navigate('/settings'); setShowUserMenu(false);}}
                      className="flex items-center px-4 py-2 text-sm text-card-foreground dark:text-dark-card-foreground hover:bg-muted dark:hover:bg-dark-muted hover:text-light-primary dark:hover:text-dark-primary transition-colors"
                    >
                      <Settings size={16} className="mr-2" /> Settings
                    </a>
                    <button
                      onClick={() => {handleLogout(); setShowUserMenu(false);}}
                      className="w-full flex items-center px-4 py-2 text-sm text-light-destructive dark:text-dark-destructive hover:bg-light-destructive/10 dark:hover:bg-dark-destructive/20 hover:text-red-700 dark:hover:text-rose-400 transition-colors"
                    >
                      <LogOut size={16} className="mr-2" /> Logout
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button 
                onClick={() => navigate("/login")} 
                // Use btn-ghost for a less prominent login button on the gradient
                className={`btn-ghost text-sm sm:text-base ${navContentColor}`}
            >
                Login
            </button>
            <button 
                onClick={() => navigate("/signup")} 
                // Primary button needs to stand out on gradient
                className="btn-primary text-sm sm:text-base"
            >
                Sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
