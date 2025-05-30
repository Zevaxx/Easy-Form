# Type-Safe Form Validation Library

A strongly-typed TypeScript form validation library that provides nested form structures with composable validation rules at field, group, and form levels.

## Features

- 🔒 Full TypeScript support with deep type inference
- 🎯 Composable validation rules at multiple levels
- 📝 Nested form structures with group validation
- 🌳 Path-based value access and updates
- 🛡️ Immutable data structures
- ⚡ Monadic validation using `@sweet-monads/either`
- 🧪 Comprehensive test coverage with property-based testing

## Installation

```bash
# Install the form library (TBC)
```

## Basic Usage

```typescript
import { Form, FormField, FormFieldGroup } from './form';
import { left, right } from '@sweet-monads/either';

// Define field validators
const notEmpty = (value: string) =>
  value.length > 0 
    ? right(value)
    : left({ message: 'Field cannot be empty' });

const isAdult = (age: number) =>
  age >= 18
    ? right(age)
    : left({ message: 'Must be 18 or older' });

// Create a simple form
const userForm = new Form({
  name: new FormField('John', notEmpty),
  age: new FormField(25, isAdult),
  email: new FormField('john@example.com')
});

// Get and update values
const name = userForm.getValueByPath('name'); // "John"
const updatedForm = userForm.setValueByPath('name', 'Jane');

// Validate the form
const validationResult = updatedForm.validateForm();
if (validationResult.isRight()) {
  console.log('Form is valid!', validationResult.value);
} else {
  console.log('Validation failed:', validationResult.value.message);
}
```

## Group-Level Validation

FormFieldGroup allows you to validate related fields together:

```typescript
// Group validator: both passwords must match
const passwordsMatch = (group: { password: FormField<string>; confirmPassword: FormField<string> }) => {
  const password = group.password.getValue();
  const confirmPassword = group.confirmPassword.getValue();
  
  return password === confirmPassword
    ? right(group)
    : left({ message: 'Passwords must match' });
};

// Address group validator: if country is US, zip code is required
const validateUSAddress = (group: { 
  country: FormField<string>; 
  zipCode: FormField<string>; 
  city: FormField<string> 
}) => {
  const country = group.country.getValue();
  const zipCode = group.zipCode.getValue();
  
  if (country === 'US' && zipCode.length === 0) {
    return left({ message: 'ZIP code is required for US addresses' });
  }
  
  return right(group);
};

const registrationForm = new Form({
  // User basic info
  username: new FormField('', notEmpty),
  
  // Password group with cross-field validation
  security: new FormFieldGroup({
    password: new FormField('', [notEmpty, minLength(8)]),
    confirmPassword: new FormField('', notEmpty)
  }, passwordsMatch), // Group validator applied here
  
  // Address group with conditional validation
  address: new FormFieldGroup({
    street: new FormField('', notEmpty),
    city: new FormField('', notEmpty),
    country: new FormField('US'),
    zipCode: new FormField('')
  }, validateUSAddress) // Conditional validation based on country
});

// Validate specific groups
const securityValidation = registrationForm.getValueByPath('security').validateGroup();
const addressValidation = registrationForm.getValueByPath('address').validateGroup();
```

## Form-Level Validation

Form-level validators can access all form data for complex business rules:

```typescript
// Form validator: check business rules across the entire form
const validateBusinessRules = (formData: {
  user: FormFieldGroup<{
    name: FormField<string>;
    age: FormField<number>;
    role: FormField<string>;
  }>;
  preferences: FormFieldGroup<{
    notifications: FormField<boolean>;
    marketing: FormField<boolean>;
  }>;
}) => {
  const user = formData.user.getFields();
  const preferences = formData.preferences.getFields();
  
  const age = user.age.getValue();
  const role = user.role.getValue();
  const marketingEnabled = preferences.marketing.getValue();
  
  // Business rule: Minors cannot opt-in to marketing
  if (age < 18 && marketingEnabled) {
    return left({ message: 'Users under 18 cannot receive marketing communications' });
  }
  
  // Business rule: Admins must have notifications enabled
  if (role === 'admin' && !preferences.notifications.getValue()) {
    return left({ message: 'Administrators must have notifications enabled' });
  }
  
  return right(formData);
};

// Another form validator: rate limiting check
const checkSubmissionRate = (formData: any) => {
  // Simulate checking if user has submitted too many forms recently
  const recentSubmissions = getUserRecentSubmissions(); // Mock function
  
  if (recentSubmissions > 5) {
    return left({ message: 'Too many submissions. Please wait before submitting again.' });
  }
  
  return right(formData);
};

const complexForm = new Form({
  user: new FormFieldGroup({
    name: new FormField('Alice', notEmpty),
    age: new FormField(16),
    role: new FormField('user')
  }),
  preferences: new FormFieldGroup({
    notifications: new FormField(true),
    marketing: new FormField(true) // This will cause validation to fail due to age < 18
  })
}, [validateBusinessRules, checkSubmissionRate]); // Multiple form-level validators

// Form validation will run:
// 1. All field validations
// 2. All group validations  
// 3. All form-level validations in sequence
const result = complexForm.validateForm();
```

## Advanced Nested Validation Example

```typescript
const minLength = (min: number) => (value: string) =>
  value.length >= min
    ? right(value)
    : left({ message: `Must be at least ${min} characters` });

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? right(email)
    : left({ message: 'Invalid email format' });

// Group validator for contact info
const validateContactGroup = (group: {
  email: FormField<string>;
  phone: FormField<string>;
}) => {
  const email = group.email.getValue();
  const phone = group.phone.getValue();
  
  // At least one contact method is required
  if (!email && !phone) {
    return left({ message: 'Either email or phone number is required' });
  }
  
  return right(group);
};

// Form validator for complete profile
const validateCompleteProfile = (formData: any) => {
  // Check if profile is complete enough for activation
  const personal = formData.personal.getFields();
  const contact = formData.contact.getFields();
  
  const hasName = personal.firstName.getValue() && personal.lastName.getValue();
  const hasContact = contact.email.getValue() || contact.phone.getValue();
  
  if (!hasName || !hasContact) {
    return left({ message: 'Profile must have complete name and contact information' });
  }
  
  return right(formData);
};

const profileForm = new Form({
  personal: new FormFieldGroup({
    firstName: new FormField('', notEmpty),
    lastName: new FormField('', notEmpty),
    bio: new FormField('', minLength(10))
  }),
  
  contact: new FormFieldGroup({
    email: new FormField('', isValidEmail),
    phone: new FormField('')
  }, validateContactGroup), // Group validation for contact methods
  
  preferences: new FormFieldGroup({
    theme: new FormField('light'),
    language: new FormField('en')
  })
}, validateCompleteProfile); // Form-level validation

// Usage with nested paths
const updatedProfile = profileForm
  .setValueByPath('personal.firstName', 'John')
  .setValueByPath('personal.lastName', 'Doe')
  .setValueByPath('contact.email', 'john.doe@example.com')
  .setValueByPath('preferences.theme', 'dark');

const validation = updatedProfile.validateForm();
```

## API Reference

### FormField

Basic form field that holds a single value with optional validators:

```typescript
// Single validator
const nameField = new FormField('John', notEmpty);

// Multiple validators
const passwordField = new FormField('', [notEmpty, minLength(8), hasUppercase]);

// No validators
const optionalField = new FormField('default value');

// Methods
nameField.getValue(); // Get current value
nameField.validate(); // Validate field - returns Either<FailedMessage, T>
```

### FormFieldGroup

Groups related fields with optional group-level validation:

```typescript
// Without group validation
const basicGroup = new FormFieldGroup({
  name: new FormField('John'),
  age: new FormField(25)
});

// With single group validator
const passwordGroup = new FormFieldGroup({
  password: new FormField(''),
  confirmPassword: new FormField('')
}, passwordsMatch);

// With multiple group validators
const addressGroup = new FormFieldGroup({
  street: new FormField(''),
  city: new FormField(''),
  country: new FormField('US')
}, [validateUSAddress, validateInternationalAddress]);

// Methods
basicGroup.getFields(); // Get the fields object
basicGroup.validateGroup(); // Validate group - returns Either<FailedMessage, T>
```

### Form

Top-level form container with form-wide validation:

```typescript
// Without form validation
const simpleForm = new Form({
  name: new FormField('John'),
  age: new FormField(25)
});

// With single form validator
const businessForm = new Form({
  user: new FormFieldGroup({ /* ... */ })
}, validateBusinessRules);

// With multiple form validators
const complexForm = new Form({
  user: new FormFieldGroup({ /* ... */ })
}, [validateBusinessRules, checkRateLimit, validateCompliance]);

// Methods
form.getForm(); // Get the form fields
form.validateForm(); // Validate entire form - returns Either<FailedMessage, T>
form.getValueByPath('path.to.field'); // Get nested value
form.setValueByPath('path.to.field', newValue); // Update nested value (returns new Form)
```

### Path-based Operations

Access and update nested values using type-safe paths:

```typescript
// Type-safe path access (TypeScript will autocomplete and validate paths)
const name = form.getValueByPath('user.personal.name');
const email = form.getValueByPath('user.contact.email');
const theme = form.getValueByPath('preferences.theme');

// Type-safe updates (TypeScript ensures value type matches field type)
const updated = form
  .setValueByPath('user.personal.name', 'Jane') // string value for string field
  .setValueByPath('user.personal.age', 30)      // number value for number field