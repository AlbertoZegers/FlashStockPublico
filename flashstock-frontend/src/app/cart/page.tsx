import Image from "next/image";
import styles from "./page.module.css";

export default function Cart() {
    return (
        <iframe src="/static/cart.html" style={{ width: '100%', height: '100vh', border: 'none' }}></iframe>
    );
}