import type { ReactNode } from "react";
import styles from "./AdminLayout.module.css";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <div className={styles.adminRoute}>{children}</div>;
}
