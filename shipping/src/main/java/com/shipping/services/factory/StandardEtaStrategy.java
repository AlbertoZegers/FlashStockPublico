package com.shipping.services.factory;

public class StandardEtaStrategy implements EtaStrategy {
    public String eta() { return "72h"; }
}
