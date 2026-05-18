import Image from "next/image";
import styles from "./page.module.css";

export default function OrderStatus() {
    return (
        <iframe src="/static/order-status.html" style={{ width: '100%', height: '100vh', border: 'none' }}></iframe>
    );
}