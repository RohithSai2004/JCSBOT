const isAdmin = localStorage.getItem('is_admin') === 'true';

// Then in your JSX:
{isAdmin && (
  <Link to="/admin" className="nav-link flex items-center gap-2">
    <ShieldCheck size={18} />
    Admin Panel
  </Link>
)}