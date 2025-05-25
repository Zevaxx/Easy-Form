# Type-Safe Form Validation Library

A strongly-typed form validation library for TypeScript that provides nested form structures with composable validation rules.

## Features

- 🔒 Full TypeScript support with strong type inference
- 🎯 Composable validation rules
- 📦 Nested form structures support
- 🛡️ Immutable data structures
- 🔍 Path-based value access and updates
- ⚡ Monadic error handling using `@sweet-monads/either`

## Installation

```bash
npm install @sweet-monads/either
```


## Basic Usage

```typescript
import { Form, FormField, FormFieldGroup } from './form';
import { left, right } from '@sweet-monads/either';

// Field validators
const notEmpty = (value: string) => 
  value.length > 0 
    ? right(value)
    : left({ message: 'Field cannot be empty' });

const isValidAge = (value: number) =>
  value >= 18
    ? right(value)
    : left({ message: 'Must be 18 or older' });

// Group validator - Validates address completeness
const addressValidator = (fields: any) => {
  const hasStreet = fields.street.getValue().length > 0;
  const hasCity = fields.city.getValue().length > 0;
  return (hasStreet && hasCity)
    ? right(fields)
    : left({ message: 'Address must be complete' });
};

// Form validator - Ensures user is eligible
const userEligibilityValidator = (fields: any) => {
  const age = fields.age.getValue();
  const hasAddress = Object.values(fields.address.getFields()).every(
    (field: any) => field.getValue().length > 0
  );
  
  return (age >= 18 && hasAddress)
    ? right(fields)
    : left({ message: 'User must be 18+ and have a complete address' });
};

// Create a form with nested validation
const userForm = new Form({
  name: new FormField('John', notEmpty),
  age: new FormField(25, isValidAge),
  address: new FormFieldGroup({
    street: new FormField('123 Main St', notEmpty),
    city: new FormField('New York', notEmpty)
  }, addressValidator)
}, userEligibilityValidator);

// Update and validate
const updatedForm = userForm
  .setFieldValue('age', 16)
  .setValueByPath('address.street', '');

const result = updatedForm.validateForm();
// result will be Left({ message: 'User must be 18+ and have a complete address' })
```

### FormFieldGroup

Groups related fields together with group-level validation:

```typescript
const addressGroup = new FormFieldGroup({
  street: new FormField(''),
  city: new FormField('')
}, groupValidator);
```

### Validation

The library uses the Either monad for validation results:
- `Right`: Successful validation
- `Left`: Validation error with message

### Path-based Access

Access and update nested values using dot notation:

```typescript
form.setValueByPath('address.street', '123 Main St');
form.getValueByPath('address.street');
```

## Type Safety

The library provides full type inference for:
- Form structure
- Field values
- Validation results
- Path strings for nested access

## Testing

The library includes a comprehensive test suite. Run tests with:

```bash
npm test
```

## License

MIT