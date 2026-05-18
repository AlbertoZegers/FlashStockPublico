package com.shipping.services.factory;

public final class EtaStrategyFactory {
    private EtaStrategyFactory() {}

    public static EtaStrategy create(String carrier) {
        if (carrier == null) {
            return new StandardEtaStrategy();
        }
        return switch (carrier.toUpperCase()) {
            case "DHL", "FEDEX", "UPS" -> new FastEtaStrategy();
            default -> new StandardEtaStrategy();
        };
    }
}
