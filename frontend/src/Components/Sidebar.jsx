import {
  Bars3Icon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <>
      {/* Sidebar Toggle Button */}
      <div className="fixed top-4 left-4 z-50">
        <Bars3Icon
          className="h-6 w-6 text-gray-800 cursor-pointer"
          onClick={toggleSidebar}
        />
      </div>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-white shadow-lg p-4 z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"
        }`}
      >
        <div className="flex items-center justify-end mb-6">
          <MagnifyingGlassIcon className="h-5 w-5 mr-3 text-gray-700 cursor-pointer" />
          <PencilSquareIcon className="h-5 w-5 text-gray-700 cursor-pointer" />
        </div>

        <h2 className="text-xl font-bold mb-6">ChatGPT Clone</h2>

        <ul className="space-y-4">
          <li className="hover:text-blue-500 cursor-pointer">New Chat</li>
          <li className="hover:text-blue-500 cursor-pointer">History</li>
          <li className="hover:text-blue-500 cursor-pointer">Settings</li>
        </ul>
      </div>
    </>
  );
};

export default Sidebar;
