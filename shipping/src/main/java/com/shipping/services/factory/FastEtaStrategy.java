package com.shipping.services.factory;

public class FastEtaStrategy implements EtaStrategy {
    public String eta() { return "24h"; }
}
