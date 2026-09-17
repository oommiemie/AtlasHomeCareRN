import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check, ShieldCheck } from "lucide-react-native";

import { ActionBar, PrimaryAction, SecondaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import type { RootStackParamList } from "../navigation/RootStack";
import { giveConsent } from "../models/session";
import {
  FILL_SUBTLE,
  PRIMARY_100,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The policy, in the sections the Act asks a notice to cover. */
const POLICY: { title: string; body: string }[] = [
  {
    title: "1. ข้อมูลที่เราเก็บรวบรวม",
    body: "ข้อมูลบัญชีผู้ใช้ (Provider ID ชื่อ สังกัด) ข้อมูลอุปกรณ์และตำแหน่งขณะเยี่ยมบ้าน และข้อมูลสุขภาพของผู้รับบริการที่ท่านบันทึกระหว่างปฏิบัติงาน เช่น สัญญาณชีพ ผลคัดกรอง การวินิจฉัย และภาพถ่าย ซึ่งถือเป็นข้อมูลส่วนบุคคลที่มีความอ่อนไหวตามมาตรา 26 แห่ง พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
  },
  {
    title: "2. วัตถุประสงค์ในการใช้ข้อมูล",
    body: "เพื่อให้บริการดูแลสุขภาพที่บ้านและบริการชุมชนตามหน้าที่ของหน่วยบริการ บันทึกเวชระเบียน ส่งต่อการรักษา เบิกจ่ายค่าบริการตามสิทธิ และจัดทำรายงานให้กระทรวงสาธารณสุขตามที่กฎหมายกำหนด",
  },
  {
    title: "3. การเปิดเผยข้อมูล",
    body: "ข้อมูลจะถูกส่งให้หน่วยบริการต้นสังกัด สำนักงานหลักประกันสุขภาพแห่งชาติ และระบบข้อมูลสุขภาพของกระทรวงสาธารณสุข (HDC) เท่าที่จำเป็นตามหน้าที่ตามกฎหมาย และจะไม่ถูกเปิดเผยแก่บุคคลอื่นเพื่อการค้า",
  },
  {
    title: "4. การเก็บรักษาและความปลอดภัย",
    body: "ข้อมูลถูกเข้ารหัสระหว่างส่งและจัดเก็บ เข้าถึงได้เฉพาะผู้มีสิทธิผ่านการยืนยันตัวตนด้วย Provider ID และรหัส PIN บนอุปกรณ์ และเก็บรักษาตามระยะเวลาที่กำหนดสำหรับเวชระเบียน",
  },
  {
    title: "5. สิทธิของเจ้าของข้อมูล",
    body: "ผู้รับบริการมีสิทธิขอเข้าถึง แก้ไข ลบ หรือระงับการใช้ข้อมูลของตน และถอนความยินยอมได้ตามที่กฎหมายกำหนด ท่านในฐานะผู้ปฏิบัติงานมีหน้าที่แจ้งสิทธินี้และบันทึกข้อมูลเท่าที่จำเป็นต่อการดูแล",
  },
  {
    title: "6. การติดต่อ",
    body: "เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO) ของหน่วยบริการ ตามช่องทางที่ประกาศไว้ที่หน่วยบริการต้นสังกัดของท่าน",
  },
];

/**
 * The privacy notice, and the two consents the Act requires before the
 * first record is written: to the policy, and — separately, because health
 * data is sensitive data — to handling patients' health data in the course
 * of the work. Both boxes, then the button lights.
 */
export function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [policy, setPolicy] = useState(false);
  const [health, setHealth] = useState(false);
  const ready = policy && health;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="นโยบายความเป็นส่วนตัว" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + 150,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: PRIMARY_100,
              }}
            >
              <ShieldCheck size={24} color={PRIMARY_500} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "700", color: TEXT_PRIMARY }}>
                ก่อนเริ่มใช้งาน
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: TEXT_SECONDARY }}>
                โปรดอ่านนโยบายและให้ความยินยอม ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
              </Text>
            </View>
          </Card>

          <Card style={{ gap: SPACE.lg }}>
            {POLICY.map((p, i) => (
              <View key={p.title} style={{ gap: 4 }}>
                {i > 0 && <View style={{ height: 1, backgroundColor: SEPARATOR, marginBottom: SPACE.md }} />}
                <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: "700", color: TEXT_PRIMARY }}>
                  {p.title}
                </Text>
                <Text style={{ fontSize: 14, lineHeight: 22, color: TEXT_SECONDARY }}>{p.body}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              ฉบับปรับปรุง 1 กันยายน 2569
            </Text>
          </Card>

          <Card style={{ gap: 2 }}>
            <Tick
              on={policy}
              onToggle={() => setPolicy((v) => !v)}
              text="ข้าพเจ้าได้อ่านและยอมรับนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งาน"
            />
            <View style={{ height: 1, backgroundColor: SEPARATOR }} />
            <Tick
              on={health}
              onToggle={() => setHealth((v) => !v)}
              text="ข้าพเจ้ายินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลสุขภาพของผู้รับบริการ เพื่อการดูแลตามหน้าที่ของหน่วยบริการ"
            />
          </Card>
        </ScrollView>
      </HeaderFade>

      <ActionBar>
        <PrimaryAction
          label="ยอมรับและดำเนินการต่อ"
          disabled={!ready}
          onPress={() => {
            giveConsent();
            nav.navigate("Facility");
          }}
        />
        <SecondaryAction label="ไม่ยอมรับ" onPress={() => nav.goBack()} />
      </ActionBar>
    </View>
  );
}

/** A consent line with its box — square, since it is a box to tick. */
function Tick({ on, onToggle, text }: { on: boolean; onToggle: () => void; text: string }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.md, paddingVertical: SPACE.md }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          marginTop: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? PRIMARY_500 : "transparent",
          borderWidth: on ? 0 : 1.5,
          borderColor: FILL_SUBTLE,
        }}
      >
        {on && <Check size={15} color="#FFFFFF" strokeWidth={3} />}
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: TEXT_PRIMARY }}>{text}</Text>
    </Pressable>
  );
}
