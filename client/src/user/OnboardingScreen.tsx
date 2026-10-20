import React, { useRef, useState } from 'react';
import {
    FlatList,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface OnboardingScreenProps {
    onComplete: () => void;
}

const slides = [
    {
        eyebrow: 'FIND GEAR',
        title: 'Tech you need, right near you',
        description: 'Discover laptops, cameras, and useful equipment from your local community.',
        icon: 'search' as const,
        accent: colors.light.primary,
        tint: colors.light.primaryLight,
        secondaryIcon: 'location' as const,
    },
    {
        eyebrow: 'EASY EARNING',
        title: 'Share your gear, earn extra income',
        description: 'List your equipment and connect with verified users who need it.',
        icon: 'hardware-chip' as const,
        accent: '#059669',
        tint: '#D1FAE5',
        secondaryIcon: 'trending-up' as const,
    },
    {
        eyebrow: 'RENT WITH CONFIDENCE',
        title: 'Track every rental with ease',
        description: 'Manage requests, schedules, and notifications all in one place.',
        icon: 'calendar' as const,
        accent: '#EA580C',
        tint: '#FFEDD5',
        secondaryIcon: 'notifications' as const,
    },
];

const termsSections = [
    {
        title: '1. Introduction',
        body: 'TechShare is a platform connecting tech equipment owners with individuals seeking short-term rentals. Unless explicitly stated otherwise, TechShare provides the matching and management platform and does not own, lease, or directly rent devices.',
    },
    {
        title: '2. Accounts and Information',
        body: 'You must provide accurate, updated information and keep your login credentials secure. You are responsible for all activities under your account. Notify TechShare immediately if you suspect unauthorized access.',
    },
    {
        title: '3. Listing Equipment',
        body: 'Device owners must hold the legitimate right to rent out their listed equipment and honestly describe condition, accessories, pricing, and availability. Listing counterfeit, prohibited, or stolen items is strictly forbidden.',
    },
    {
        title: '4. Bookings and Handover',
        body: 'Renters and owners must carefully inspect booking details, confirm requests within the app, and coordinate physical handover and returns. Both parties should verify device condition and keep handover confirmation records.',
    },
    {
        title: '5. Rental Pricing, Payments and Cancellations',
        body: 'Rental fees, security deposits, and payment methods are clearly shown during the booking process. Please review all costs and cancellation terms before confirming.',
    },
    {
        title: '6. Conduct and Safety',
        body: 'You agree to communicate respectfully and refrain from fraudulent, abusive, or unlawful actions. Never disclose sensitive passwords or verification OTPs to anyone. Always conduct item handovers in safe locations.',
    },
    {
        title: '7. Gemini AI Assistant',
        body: 'The integrated Gemini AI assistant provides rental guidance, recommendations, and search assistance. AI output is for informational purposes and should be verified before making rental commitments.',
    },
    {
        title: '8. Content and Dispute Resolution',
        body: 'Users are responsible for content they publish and agree to resolve rental disputes in good faith. TechShare may review incident reports and take necessary moderation actions against violating accounts.',
    },
    {
        title: '9. Data Privacy and Terms Updates',
        body: 'TechShare processes necessary account and transaction information in accordance with our privacy practices and applicable laws. Terms may be updated periodically to reflect service enhancements.',
    },
    {
        title: '10. Contact and Support',
        body: 'For questions or support inquiries, please contact our support team through the help channels provided in the TechShare app.',
    },
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const { width } = useWindowDimensions();
    const listRef = useRef<FlatList<(typeof slides)[number]>>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [showTerms, setShowTerms] = useState(false);

    const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
        setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    };

    const goToNextSlide = () => {
        if (activeIndex === slides.length - 1) {
            if (hasAcceptedTerms) onComplete();
            return;
        }
        listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    };

    const skipToFinalSlide = () => {
        listRef.current?.scrollToIndex({ index: slides.length - 1, animated: true });
    };

    if (showTerms) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.termsTopBar}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => setShowTerms(false)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Back to onboarding"
                    >
                        <Ionicons name="arrow-back" size={23} color={colors.light.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.termsNavTitle}>Terms of Service</Text>
                    <View style={styles.backButtonSpacer} />
                </View>
                <ScrollView
                    contentContainerStyle={styles.termsContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.termsTitle}>TECHSHARE TERMS OF SERVICE</Text>
                    <Text style={styles.termsSubtitle}>
                        TechShare Project - Peer-to-Peer Tech Rental Platform & Gemini AI Assistant
                    </Text>
                    <Text style={styles.termsDraftNote}>
                        Draft agreement. Please review carefully before using the service.
                    </Text>
                    {termsSections.map((section) => (
                        <View key={section.title} style={styles.termsSection}>
                            <Text style={styles.termsSectionTitle}>{section.title}</Text>
                            <Text style={styles.termsBody}>{section.body}</Text>
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.topBar}>
                <View style={styles.brandMark}>
                    <Ionicons name="hardware-chip" size={17} color="#FFFFFF" />
                </View>
                <Text style={styles.brandName}>TechShare</Text>
                {activeIndex < slides.length - 1 ? (
                    <TouchableOpacity onPress={skipToFinalSlide} hitSlop={12} accessibilityRole="button">
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.topBarSpacer} />
                )}
            </View>

            <FlatList
                ref={listRef}
                data={slides}
                keyExtractor={(item: (typeof slides)[number]) => item.eyebrow}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                renderItem={({ item }: { item: (typeof slides)[number] }) => (
                    <View style={[styles.slide, { width }]}>
                        <View style={[styles.artwork, activeIndex === slides.length - 1 && styles.finalArtwork, { backgroundColor: item.tint }]}>
                            <View style={[styles.iconTile, { backgroundColor: item.accent }]}>
                                <Ionicons name={item.icon} size={54} color="#FFFFFF" />
                            </View>
                            <View style={[styles.secondaryTile, styles.secondaryTop]}>
                                <Ionicons name={item.secondaryIcon} size={23} color={item.accent} />
                            </View>
                            <View style={[styles.secondaryTile, styles.secondaryBottom]}>
                                <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                            </View>
                            <View style={[styles.artworkLine, { backgroundColor: item.accent }]} />
                        </View>
                        <Text style={[styles.eyebrow, { color: item.accent }]}>{item.eyebrow}</Text>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.description}>{item.description}</Text>
                        {activeIndex === slides.length - 1 ? (
                            <View style={styles.acceptTermsRow}>
                                <TouchableOpacity
                                    style={[styles.checkbox, hasAcceptedTerms && styles.checkboxChecked]}
                                    onPress={() => setHasAcceptedTerms(!hasAcceptedTerms)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: hasAcceptedTerms }}
                                    accessibilityLabel="Agree to Terms of Service"
                                >
                                    {hasAcceptedTerms ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                                </TouchableOpacity>
                                <Text style={styles.acceptTermsText}>
                                    I have read and agree to the{' '}
                                    <Text
                                        style={styles.termsLink}
                                        onPress={() => setShowTerms(true)}
                                        accessibilityRole="link"
                                    >
                                        Terms of Service
                                    </Text>
                                </Text>
                            </View>
                        ) : null}
                    </View>
                )}
            />

            <View style={styles.footer}>
                <View style={styles.pagination} accessibilityLabel={`Slide ${activeIndex + 1} of ${slides.length}`}>
                    {slides.map((slide, index) => (
                        <View
                            key={slide.eyebrow}
                            style={[
                                styles.paginationDot,
                                index === activeIndex && [styles.paginationDotActive, { backgroundColor: slide.accent }],
                            ]}
                        />
                    ))}
                </View>
                <TouchableOpacity
                    style={[styles.nextButton, activeIndex === slides.length - 1 && !hasAcceptedTerms && styles.nextButtonDisabled]}
                    onPress={goToNextSlide}
                    activeOpacity={0.85}
                    disabled={activeIndex === slides.length - 1 && !hasAcceptedTerms}
                    accessibilityRole="button"
                >
                    <Text style={styles.nextButtonText}>
                        {activeIndex === slides.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                    <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.light.background,
    },
    topBar: {
        height: 56,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandMark: {
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.light.primary,
    },
    brandName: {
        flex: 1,
        marginLeft: 9,
        color: colors.light.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    skipText: {
        color: colors.light.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    topBarSpacer: {
        width: 42,
    },
    slide: {
        flex: 1,
        paddingHorizontal: 28,
        justifyContent: 'center',
        paddingBottom: 12,
    },
    artwork: {
        height: 280,
        width: '100%',
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        overflow: 'hidden',
    },
    finalArtwork: {
        height: 210,
        marginBottom: 24,
    },
    iconTile: {
        width: 128,
        height: 128,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-6deg' }],
    },
    secondaryTile: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#0F172A',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    secondaryTop: {
        top: 48,
        right: '18%',
    },
    secondaryBottom: {
        bottom: 44,
        left: '18%',
        backgroundColor: '#0F172A',
    },
    artworkLine: {
        position: 'absolute',
        width: 44,
        height: 4,
        borderRadius: 2,
        bottom: 66,
        right: '22%',
        opacity: 0.45,
    },
    eyebrow: {
        marginBottom: 12,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
    title: {
        maxWidth: 340,
        color: colors.light.textPrimary,
        fontSize: 30,
        lineHeight: 38,
        fontWeight: '800',
    },
    description: {
        maxWidth: 340,
        marginTop: 14,
        color: colors.light.textSecondary,
        fontSize: 16,
        lineHeight: 24,
    },
    acceptTermsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderWidth: 1.5,
        borderColor: colors.light.textSecondary,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    checkboxChecked: {
        borderColor: colors.light.primary,
        backgroundColor: colors.light.primary,
    },
    acceptTermsText: {
        flex: 1,
        color: colors.light.textSecondary,
        fontSize: 13,
        lineHeight: 20,
    },
    termsLink: {
        color: colors.light.primary,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    nextButtonDisabled: {
        backgroundColor: '#94A3B8',
    },
    termsTopBar: {
        minHeight: 56,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.light.border,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    termsNavTitle: {
        flex: 1,
        color: colors.light.textPrimary,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
    },
    backButtonSpacer: {
        width: 40,
    },
    termsContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
    },
    termsTitle: {
        color: colors.light.textPrimary,
        fontSize: 21,
        lineHeight: 28,
        fontWeight: '800',
    },
    termsSubtitle: {
        marginTop: 10,
        color: colors.light.textSecondary,
        fontSize: 14,
        lineHeight: 21,
        fontWeight: '600',
    },
    termsDraftNote: {
        marginTop: 14,
        marginBottom: 20,
        color: '#9A3412',
        backgroundColor: '#FFF7ED',
        padding: 12,
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 19,
    },
    termsSection: {
        marginTop: 18,
    },
    termsSectionTitle: {
        color: colors.light.textPrimary,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '700',
    },
    termsBody: {
        marginTop: 6,
        color: colors.light.textSecondary,
        fontSize: 14,
        lineHeight: 22,
    },
    footer: {
        paddingHorizontal: 28,
        paddingTop: 12,
        paddingBottom: 20,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
    },
    paginationDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.light.border,
    },
    paginationDotActive: {
        width: 24,
    },
    nextButton: {
        height: 54,
        borderRadius: 12,
        paddingHorizontal: 22,
        backgroundColor: colors.light.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default OnboardingScreen;