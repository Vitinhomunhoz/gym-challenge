import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, Animated, Easing, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Theme, useTheme, FONT } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function makeStyles(T: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: T.surface, borderRadius: T.radius, padding: 18,
      shadowColor: T.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16,
      elevation: 2,
    },
    btn: { paddingVertical: 16, paddingHorizontal: 22, borderRadius: 999, alignItems: 'center' },
    btnPrimary: {
      backgroundColor: T.primary,
      shadowColor: T.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3,
    },
    btnGold: {
      backgroundColor: T.gold,
      shadowColor: T.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3,
    },
    btnGhost: { backgroundColor: T.surface2 },
    btnText: { color: '#fff', fontFamily: FONT.extraBold, fontSize: 15 },
    track: { height: 10, borderRadius: 999, backgroundColor: T.surface2, overflow: 'hidden' },
    fill: { height: 10, borderRadius: 999 },
    ringOuter: { alignItems: 'center', justifyContent: 'center' },
    ringInner: { position: 'absolute', alignItems: 'center' },
    ringLevel: { color: T.text, fontSize: 32, fontFamily: FONT.extraBold, lineHeight: 36 },
    ringLabel: { color: T.textDim, fontSize: 10, letterSpacing: 2, fontFamily: FONT.bold },
    avatar: { backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontFamily: FONT.extraBold },
    stat: { flex: 1, alignItems: 'center', gap: 6 },
    statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    statValue: { color: T.text, fontSize: 18, fontFamily: FONT.extraBold },
    statLabel: { color: T.textDim, fontFamily: FONT.regular, fontSize: 11 },
    pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: T.surface2 },
    pillActive: { backgroundColor: T.primary },
    pillText: { color: T.textDim, fontFamily: FONT.bold, fontSize: 12 },
    pillTextActive: { color: '#fff' },
  });
}

function useUIStyles() {
  const { theme: T } = useTheme();
  return React.useMemo(() => makeStyles(T), [T]);
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => {
  const s = useUIStyles();
  return <View style={[s.card, style]}>{children}</View>;
};

export const SelectPill = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const s = useUIStyles();
  return (
    <Pressable onPress={onPress} style={[s.pill, active && s.pillActive]}>
      <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
    </Pressable>
  );
};

// Entrada suave (fade + slide) — usada para revelar cards em cascata quando uma tela monta
export const FadeSlideIn = ({ children, delay = 0, duration = 420, style }: {
  children: React.ReactNode; delay?: number; duration?: number; style?: ViewStyle;
}) => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export const Btn = ({ label, onPress, variant = 'primary', disabled }: {
  label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'gold'; disabled?: boolean;
}) => {
  const { theme: T } = useTheme();
  const s = useUIStyles();
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => !disabled && animateTo(0.96)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View
        style={[
          s.btn,
          variant === 'primary' && s.btnPrimary,
          variant === 'gold' && s.btnGold,
          variant === 'ghost' && s.btnGhost,
          disabled && { opacity: 0.5 },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={[s.btnText, variant === 'gold' && { color: '#3D2600' }, variant === 'ghost' && { color: T.textDim }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

export const Progress = ({ value, max, color }: { value: number; max: number; color?: string }) => {
  const { theme: T } = useTheme();
  const s = useUIStyles();
  const resolvedColor = color ?? T.primary;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const anim = React.useRef(new Animated.Value(pct)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // largura não é suportada pelo native driver
    }).start();
  }, [pct]);

  return (
    <View style={s.track}>
      <Animated.View
        style={[s.fill, { backgroundColor: resolvedColor, width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
};

// Anel de nível: elemento-assinatura do app — anel de progresso em SVG, no estilo "activity ring"
export const LevelRing = ({ level, pct }: { level: number; pct: number }) => {
  const { theme: T } = useTheme();
  const s = useUIStyles();
  const size = 112;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const clamped = Math.min(1, Math.max(0, Number.isFinite(pct) ? pct : 0));
  const anim = React.useRef(new Animated.Value(0)).current;
  const pop = React.useRef(new Animated.Value(0.7)).current;

  React.useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [clamped]);

  React.useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }).start();
  }, []);

  const strokeDashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  return (
    <Animated.View style={[s.ringOuter, { width: size, height: size, transform: [{ scale: pop }] }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={T.surface2} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius} stroke={T.primary} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation={-90} origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={s.ringInner}>
        <Text style={s.ringLevel}>{level}</Text>
        <Text style={s.ringLabel}>NÍVEL</Text>
      </View>
    </Animated.View>
  );
};

export const Avatar = ({ name, photo, size = 44 }: { name: string; photo?: string; size?: number }) => {
  const { theme: T } = useTheme();
  const s = useUIStyles();
  if (photo) {
    return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.surface2 }} />;
  }
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.42 }]}>{(name.trim().charAt(0) || '?').toUpperCase()}</Text>
    </View>
  );
};

export const Stat = ({ icon, value, label, tint, iconColor }: {
  icon: keyof typeof Ionicons.glyphMap; value: string; label: string; tint?: string; iconColor?: string;
}) => {
  const { theme: T } = useTheme();
  const s = useUIStyles();
  const resolvedTint = tint ?? T.primarySoft;
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: resolvedTint }]}>
        <Ionicons name={icon} size={20} color={iconColor ?? T.primary} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
};
