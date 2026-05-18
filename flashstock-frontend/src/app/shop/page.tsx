import Image from "next/image";
import styles from "./page.module.css";

export default function Shop() {
    return (
        <iframe src="/static/shop.html" style={{ width: '100%', height: '100vh', border: 'none' }}></iframe>
    );
}