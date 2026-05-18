import Image from "next/image";
import styles from "./page.module.css";

export default function Checkout() {
    return (
        <iframe src="/static/checkout.html" style={{ width: '100%', height: '100vh', border: 'none' }}></iframe>
    );
}