import { createSetting, createSettings } from '../settings';

export const BplaceSettings = createSettings('bplace-platform', 1, {
    enableDailyLocationHighlight: createSetting(true),
    dailyLocationHighlightOpacity: createSetting(0.25),

    hideAchievementConfetti: createSetting(false),
    hideBuyChromasButton: createSetting(false),
    hideGuildNotificationBadge: createSetting(false),

    blockAnalytics: createSetting(true),
    fakeBetaTester: createSetting(false),

    showGuildPinContributorNotification: createSetting(true),
    showPinPublishedNotification: createSetting(true),
    showPinCollabAcceptedNotification: createSetting(true),
});
