type AdminTab = "overview" | "card-orders" | "print-orders" | "qa";

export default function AdminDashboardTabs({ activeTab: _activeTab }: { activeTab: AdminTab }) {
  void _activeTab;
  return null;
}
