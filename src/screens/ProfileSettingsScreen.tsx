import { Alert, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Lock } from "lucide-react-native";

import { Card } from "../components/Card";
import { Glass } from "../components/Glass";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import { UserPhoto } from "../components/UserPhoto";
import { toast } from "../components/Toast";
import { feel } from "../utils/haptics";
import { setPhoto, useSession } from "../models/session";
import {
  maskCitizenId,
  prettyPhone,
  professionLabel,
} from "../models/providerAccount";
import { thaiFullDate } from "../utils/thaiDate";
import {
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { tr } from "../i18n";

/**
 * "โปรไฟล์" — the account as the provider register holds it.
 *
 * Everything here is read-only, and the page is built to say so rather
 * than to look disabled: no fields, no pencils, a small lock against each
 * value and one line at the foot pointing at the place that can change
 * them. A telephone number edited here would be true in this app and
 * nowhere else, which is worse than not offering the edit.
 *
 * The photograph is the exception, and the only one. It is the app's own,
 * it never leaves the phone, and it is what the carer sees of themselves
 * on every screen — so it is the one thing the page lets them set, and it
 * is put at the top where the rest of the page is plainly not editable.
 */
export function ProfileSettingsScreen() {
  const me = useSession();
  const account = me.account;

  const pickPhoto = () => {
    const shoot = async (fromCamera: boolean) => {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast(
          fromCamera
            ? tr("ต้องอนุญาตให้ใช้กล้องก่อน", "Allow camera access first")
            : tr(
                "ต้องอนุญาตให้เข้าคลังภาพก่อน",
                "Allow photo library access first",
              ),
          "error",
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        // Square, because every place it is shown is a circle.
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const shot = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (shot.canceled) return;
      setPhoto(shot.assets[0].uri);
      feel("success");
      toast(tr("เปลี่ยนรูปโปรไฟล์แล้ว", "Profile photo changed"), "success");
    };

    Alert.alert(tr("รูปโปรไฟล์", "Profile photo"), undefined, [
      { text: tr("ถ่ายภาพ", "Take photo"), onPress: () => void shoot(true) },
      {
        text: tr("เลือกจากคลังภาพ", "Choose from library"),
        onPress: () => void shoot(false),
      },
      // Only worth offering once there is something of theirs to remove.
      ...(me.photo != null
        ? [
            {
              text: tr("ใช้รูปเริ่มต้น", "Use default photo"),
              style: "destructive" as const,
              onPress: () => {
                setPhoto(null);
                feel("tick");
                toast(
                  tr("กลับไปใช้รูปเริ่มต้นแล้ว", "Back to the default photo"),
                  "success",
                );
              },
            },
          ]
        : []),
      { text: tr("ยกเลิก", "Cancel"), style: "cancel" as const },
    ]);
  };

  return (
    <SettingsScreen
      title={tr("โปรไฟล์", "Profile")}
      footnote={tr(
        "ชื่อ เลขบัตรประชาชน วันเกิด เบอร์โทรศัพท์ อีเมล และตำแหน่ง มาจากระบบ Provider ID แก้ไขได้ที่ id.moph.go.th เท่านั้น แก้ในแอพนี้จะจริงแค่ในเครื่อง · สถานพยาบาลที่เข้าใช้งานเลือกตอนเข้าสู่ระบบ และคงอยู่ตลอดการใช้งานครั้งนั้น ถ้าต้องการเปลี่ยนให้ออกจากระบบแล้วเข้าใหม่ · รูปโปรไฟล์เก็บไว้ในเครื่องนี้และไม่ถูกส่งออกไปไหน",
        "Your name, citizen ID, date of birth, phone, email and post come from Provider ID and can only be changed at id.moph.go.th; a change made in this app would be true on this phone only. · The facility you work under is chosen at sign-in and stays for the whole session. To change it, sign out and sign in again. · Your profile photo is kept on this device and never sent anywhere.",
      )}
    >
      {/* The one thing on the page that can be changed, at the top of it. */}
      <Card>
        <View style={{ alignItems: "center", gap: SPACE.md }}>
          <Pressable
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel={tr("เปลี่ยนรูปโปรไฟล์", "Change profile photo")}
          >
            <View>
              <UserPhoto size={116} ring={PRIMARY_500} />
              {/* The badge says the picture is a control. Without it the
                  photograph reads as another thing the page is showing. */}
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 2,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: PRIMARY_500,
                  borderWidth: 2.5,
                  borderColor: SURFACE,
                }}
              >
                <Camera size={16} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </View>
          </Pressable>

          <View style={{ alignItems: "center", gap: 2 }}>
            <Text
              style={{ fontSize: 20, fontWeight: "800", color: TEXT_PRIMARY }}
            >
              {tr(`คุณ ${me.displayName}`, me.displayName)}
            </Text>
            {/*
              The post on glass, the way the account card downstairs wears
              its facility.

              The material has less to work with here: that one sits over a
              blue ramp and refracts it, and this one is on white paper, so
              what it draws is a pale capsule with the rim and highlight
              the system gives it rather than anything caught from behind.
            */}
            <Glass
              style={{
                marginTop: 2,
                paddingHorizontal: SPACE.md,
                paddingVertical: 4,
                borderRadius: RADIUS.capsule,
                overflow: "hidden",
              }}
            >
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: PRIMARY_500 }}
              >
                {account != null
                  ? professionLabel(account.profession)
                  : tr("เจ้าหน้าที่", "Staff")}
              </Text>
            </Glass>
          </View>

          <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
            {tr("แตะรูปเพื่อเปลี่ยน", "Tap the photo to change it")}
          </Text>
        </View>
      </Card>

      <SettingsGroup title={tr("ข้อมูลผู้ใช้งาน", "Account details")}>
        <Card padded={false}>
          <Row label={tr("ชื่อผู้ใช้งาน", "Username")} value={account?.username} />
          <Row label={tr("ชื่อ-นามสกุล", "Full name")} value={me.displayName} />
          <Row
            label={tr("หมายเลขบัตรประชาชน", "Citizen ID")}
            value={
              account == null ? undefined : maskCitizenId(account.citizenId)
            }
          />
          <Row
            label={tr("วันเดือนปีเกิด", "Date of birth")}
            value={
              account == null
                ? undefined
                : thaiFullDate(new Date(account.birthDate))
            }
          />
          <Row
            label={tr("เบอร์โทรศัพท์", "Phone")}
            value={account == null ? undefined : prettyPhone(account.phone)}
          />
          <Row label={tr("อีเมล", "Email")} value={account?.email} last />
        </Card>
      </SettingsGroup>

      <SettingsGroup title={tr("ข้อมูลวิชาชีพ", "Professional details")}>
        <Card padded={false}>
          <Row
            label={tr("ตำแหน่ง/วิชาชีพ", "Post / profession")}
            value={
              account == null ? undefined : professionLabel(account.profession)
            }
          />
          <Row
            label={tr("สถานพยาบาลที่เข้าใช้งาน", "Facility signed in under")}
            value={me.facility?.name}
          />
          <Row
            label={tr("รหัสสถานพยาบาล", "Facility code")}
            value={
              me.facility == null
                ? undefined
                : `${me.facility.code} · ${me.facility.district}`
            }
            last
          />
        </Card>
      </SettingsGroup>

      {/* Where the account comes from, and where it is changed. */}
      <SettingsGroup title={tr("การเข้าสู่ระบบ", "Sign-in")}>
        <Card>
          {/* The mark stands on its own line: it is a wordmark two and a
              half times wider than it is tall, and set beside the text it
              would have squeezed the sentence into a column. */}
          <View style={{ gap: SPACE.md }}>
            <Image
              source={require("../../assets/images/provider_id_logo.webp")}
              style={{ width: 138, height: 60 }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Provider ID"
            />
            <View style={{ gap: 3 }}>
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY }}
              >
                {tr(
                  "บัญชีนี้เข้าสู่ระบบด้วย Provider ID",
                  "This account signs in with Provider ID",
                )}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                {tr(
                  "บัญชี Provider ID ออกให้บุคลากรสาธารณสุขโดยสำนักสุขภาพดิจิทัล กระทรวงสาธารณสุข ข้อมูลในหน้านี้จึงมาจากทะเบียนนั้น ไม่ได้ตั้งค่าในแอพ",
                  "Provider ID accounts are issued to public health workers by the Digital Health Office, Ministry of Public Health, so the details on this page come from that register rather than from settings in the app.",
                )}
              </Text>
            </View>
          </View>
        </Card>
      </SettingsGroup>
    </SettingsScreen>
  );
}

/**
 * One fact from the register: what it is called, what it says, and a lock.
 *
 * The lock rather than a greyed-out field. A disabled text box still looks
 * like somewhere to type and invites the tap that does nothing; a plain
 * line of text with a closed padlock beside it reads as a record, which is
 * what this is.
 */
function Row({
  label,
  value,
  last,
}: {
  label: string;
  value?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderBottomWidth: last === true ? 0 : 1,
        borderBottomColor: SEPARATOR,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            lineHeight: 21,
            fontWeight: "600",
            color: value == null || value === "" ? TEXT_DISABLED : TEXT_PRIMARY,
          }}
        >
          {value == null || value === "" ? "-" : value}
        </Text>
        <Lock size={13} color={TEXT_DISABLED} strokeWidth={2.2} />
      </View>
    </View>
  );
}
