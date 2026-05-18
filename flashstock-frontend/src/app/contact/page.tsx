import Image from "next/image";
import styles from "./page.module.css";

export default function Contact() {
    return (
        <iframe src="/static/contact.html" style={{ width: '100%', height: '100vh', border: 'none' }}></iframe>
    );
}