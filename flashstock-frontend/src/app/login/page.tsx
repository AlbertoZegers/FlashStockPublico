import Image from "next/image";
import styles from "./page.module.css";

export default function Login() {
    return (
        <iframe src="/static/login.html" style={{ width: '100%', height: '100vh', border: 'none' }}></iframe>
    );
}