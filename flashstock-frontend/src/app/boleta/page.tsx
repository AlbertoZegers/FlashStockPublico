import Image from "next/image";
import styles from "./page.module.css";

export default function Boleta() {
    return (
        <iframe src="/static/boleta.html" style={{ width: '100%', height: '100vh', border: 'none' }}></iframe>
    );
}