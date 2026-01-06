import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { auth } from './firebase';
import { signInWithPhoneNumber } from 'firebase/auth';
import axios from 'axios';

export default function App() {
  const [screen, setScreen] = useState('signup'); // 'signup' or 'login'

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RescueLink Test App</Text>
      <View style={styles.switchRow}>
        <Button title="Sign Up" onPress={() => setScreen('signup')} />
        <Button title="Login" onPress={() => setScreen('login')} />
      </View>
      {screen === 'signup' ? <SignupScreen /> : <LoginScreen />}
    </View>
  );
}

function SignupScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [step, setStep] = useState(1); // 1: enter phone, 2: enter OTP

  // 1. Send SMS
  const sendCode = async () => {
    try {
      const confirmation = await signInWithPhoneNumber(auth, phone);
      setConfirm(confirmation);
      setStep(2);
      Alert.alert('OTP sent!');
    } catch (e) {
      Alert.alert('Error sending OTP', e.message);
    }
  };

  // 2. Verify OTP and onboard
  const verifyAndOnboard = async () => {
    try {
      const userCred = await confirm.confirm(otp);
      const idToken = await userCred.user.getIdToken();
      // Call backend onboarding
      const res = await axios.post('http://localhost:3000/api/auth/onboard-phone', {
        idToken,
        password,
        firstName,
        lastName,
      });
      Alert.alert('Onboarded!', JSON.stringify(res.data));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.form}>
      {step === 1 ? (
        <>
          <TextInput style={styles.input} placeholder="Phone (+1234567890)" value={phone} onChangeText={setPhone} />
          <TextInput style={styles.input} placeholder="First Name" value={firstName} onChangeText={setFirstName} />
          <TextInput style={styles.input} placeholder="Last Name" value={lastName} onChangeText={setLastName} />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Button title="Send OTP" onPress={sendCode} />
        </>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="OTP Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
          <Button title="Verify & Register" onPress={verifyAndOnboard} />
        </>
      )}
    </View>
  );
}

function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const login = async () => {
    try {
      const res = await axios.post('http://localhost:3000/api/auth/login', {
        phone,
        password,
      });
      Alert.alert('Login success', JSON.stringify(res.data));
    } catch (e) {
      Alert.alert('Login failed', e.message);
    }
  };
  return (
    <View style={styles.form}>
      <TextInput style={styles.input} placeholder="Phone (+1234567890)" value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Login" onPress={login} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  switchRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  form: { width: '100%', maxWidth: 350 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 10 },
});
