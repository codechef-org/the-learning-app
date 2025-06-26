import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
    Avatar,
    Badge,
    Button,
    Card,
    Checkbox,
    Chip,
    Divider,
    FAB,
    IconButton,
    ProgressBar,
    RadioButton,
    SegmentedButtons,
    Switch,
    Text,
    TextInput,
} from 'react-native-paper';

export default function PaperExamples() {
  const [text, setText] = useState('');
  const [isSwitchOn, setIsSwitchOn] = useState(false);
  const [checked, setChecked] = useState('first');
  const [isChecked, setIsChecked] = useState(false);
  const [selectedValue, setSelectedValue] = useState('option1');

  const onToggleSwitch = () => setIsSwitchOn(!isSwitchOn);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>
        React Native Paper Components
      </Text>
      
      {/* Cards */}
      <Card style={styles.card}>
        <Card.Title 
          title="Card Title" 
          subtitle="Card subtitle"
          left={(props) => <Avatar.Icon {...props} icon="folder" />}
        />
        <Card.Content>
          <Text variant="bodyMedium">
            This is a sample card with content. You can add any content here.
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button>Cancel</Button>
          <Button mode="contained">Ok</Button>
        </Card.Actions>
      </Card>

      {/* Buttons */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Buttons</Text>
      <Button mode="contained" onPress={() => console.log('Pressed')} style={styles.button}>
        Contained Button
      </Button>
      <Button mode="outlined" onPress={() => console.log('Pressed')} style={styles.button}>
        Outlined Button
      </Button>
      <Button mode="text" onPress={() => console.log('Pressed')} style={styles.button}>
        Text Button
      </Button>

      {/* Text Input */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Text Input</Text>
      <TextInput
        label="Email"
        value={text}
        onChangeText={setText}
        mode="outlined"
        style={styles.textInput}
      />

      {/* Chips */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Chips</Text>
      <Chip icon="information" onPress={() => console.log('Pressed')}>
        Example Chip
      </Chip>

      {/* Switch and Checkbox */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Controls</Text>
      <Switch value={isSwitchOn} onValueChange={onToggleSwitch} />
      <Checkbox
        status={isChecked ? 'checked' : 'unchecked'}
        onPress={() => setIsChecked(!isChecked)}
      />

      {/* Radio Buttons */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Radio Buttons</Text>
      <RadioButton.Group onValueChange={newValue => setChecked(newValue)} value={checked}>
        <RadioButton.Item label="First item" value="first" />
        <RadioButton.Item label="Second item" value="second" />
      </RadioButton.Group>

      {/* Segmented Buttons */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Segmented Buttons</Text>
      <SegmentedButtons
        value={selectedValue}
        onValueChange={setSelectedValue}
        buttons={[
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
          { value: 'option3', label: 'Option 3' },
        ]}
      />

      {/* Progress Bar */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Progress Bar</Text>
      <ProgressBar progress={0.7} color="#6200ea" />

      {/* Avatar with Badge */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Avatar with Badge</Text>
      <Badge size={20} style={styles.badge}>3</Badge>
      <Avatar.Image size={50} source={{uri: 'https://picsum.photos/50'}} />

      <Divider style={styles.divider} />

      {/* Icon Buttons */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Icon Buttons</Text>
      <IconButton
        icon="camera"
        mode="contained"
        size={30}
        onPress={() => console.log('Pressed')}
      />

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => console.log('FAB pressed')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    marginBottom: 16,
  },
  button: {
    marginVertical: 4,
  },
  textInput: {
    marginBottom: 16,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
  },
  divider: {
    marginVertical: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
}); 