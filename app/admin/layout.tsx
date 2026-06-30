import type { ReactNode } from "react";
import rail from "./AdminRail.module.css";
import styles from "./AdminLayout.module.css";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <div className={`${styles.adminRoute} ${rail.railBackground}`}>{children}</div>;
}
