import { describe, it, expect } from 'vitest';
import { left, right } from '@sweet-monads/either';
import { Form, FormField, FormFieldGroup } from '../form/Form';

describe('Form Validation', () => {
	// Simple field validator
	const notEmptyValidator = (value: string) =>
		value.length > 0
			? right(value)
			: left({ message: 'Field cannot be empty' });

	// Basic form setup
	const createBasicForm = () => {
		const nameField = new FormField('', notEmptyValidator);
		return new Form({ name: nameField }, () => right({ name: nameField }));
	};

	it('should create a form with fields', () => {
		const form = createBasicForm();
		expect(form.getForm()).toBeTruthy();
	});

	it('should validate empty field and return error', () => {
		const form = createBasicForm();
		const result = form.validateForm();
		expect(result.isLeft()).toBe(true);
	});

	it('should validate field with valid input', () => {
		const form = createBasicForm();
		const updatedForm = form.setValueByPath('name', 'John');
		const result = updatedForm.validateForm();
		expect(result.isRight()).toBe(true);
	});

	it('should handle field value updates', () => {
		const form = createBasicForm();
		const updatedForm = form.setValueByPath('name', 'John');
		expect(updatedForm.getForm().name.getValue()).toBe('John');
	});

	describe('FormFieldGroup', () => {
		const createGroupForm = () => {
			return new Form({
				address: new FormFieldGroup({
					street: new FormField('', notEmptyValidator),
					city: new FormField('', notEmptyValidator),
				}),
			});
		};

		it('should validate nested form group', () => {
			const form = createGroupForm();
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});

		it('should validate form group with valid inputs', () => {
			let form = createGroupForm()
				.setValueByPath('address.street', '123 Main St')
				.setValueByPath('address.city', 'New York');
			const result = form.validateForm();
			expect(result.isRight()).toBe(true);
		});
	});

	describe('Complex Validation', () => {
		const matchingFieldsValidator = (fields: any) =>
			fields.password.getValue() === fields.confirmPassword.getValue()
				? right(fields)
				: left({ message: 'Passwords do not match' });

		const createPasswordForm = () => {
			const form = new Form(
				{
					password: new FormField('', notEmptyValidator),
					confirmPassword: new FormField('', notEmptyValidator),
				},
				matchingFieldsValidator
			);
			return form;
		};

		it('should validate matching passwords', () => {
			let form = createPasswordForm()
				.setValueByPath('password', 'secret')
				.setValueByPath('confirmPassword', 'secret');
			const result = form.validateForm();
			expect(result.isRight()).toBe(true);
		});

		it('should fail validation for non-matching passwords', () => {
			let form = createPasswordForm()
				.setValueByPath('password', 'secret1')
				.setValueByPath('confirmPassword', 'secret2');
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});
	});

	describe('Validate some complex validation with objects and arrays', () => {
		const createComplexForm = () => {
			return new Form(
				{
					name: new FormField('', notEmptyValidator),
					items: new FormFieldGroup(
						{
							item1: new FormField('', notEmptyValidator),
							item2: new FormField(''),
						},
						(fields) => {
							if (Object.keys(fields).length === 0) {
								return left({
									message: 'At least one item is required',
								});
							}
							return right(fields);
						}
					),
				},
				(fields) => {
					if (Object.keys(fields.items.getFields()).length === 0) {
						return left({
							message: 'At least one item is required',
						});
					}
					return right(fields);
				}
			);
		};

		it('should validate complex form with nested fields', () => {
			const form = createComplexForm();
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});

		it('should validate complex form with valid inputs', () => {
			const form = createComplexForm()
				.setValueByPath('name', 'Test')
				.setValueByPath('items.item1', 'Item 1');
			const result = form.validateForm();
			expect(result.isRight()).toBe(true);
		});

		it('should fail validation if no items are provided', () => {
			const form = createComplexForm().setValueByPath('name', 'Test');
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});
	});
});

describe('FormField', () => {
	it('should create a field with initial value', () => {
		const field = new FormField('test value');
		expect(field.getValue()).toBe('test value');
	});

	it('should validate successfully with no validators', () => {
		const field = new FormField('test');
		const result = field.validate();
		expect(result.isRight()).toBe(true);
		if (result.isRight()) {
			expect(result.value).toBe('test');
		}
	});

	it('should fail validation with failing validator', () => {
		const validator = (value: string) =>
			value.length > 5 ? right(value) : left({ message: 'Too short' });

		const field = new FormField('hi', validator);
		const result = field.validate();

		expect(result.isLeft()).toBe(true);
		if (result.isLeft()) {
			expect(result.value.message).toBe('Too short');
		}
	});

	it('should update value correctly', () => {
		const field = new FormField('old');
		const newField = field.setNewValue('new');

		expect(field.getValue()).toBe('old'); // Original unchanged
		expect(newField.getValue()).toBe('new'); // New instance updated
	});
});

describe('FormFieldGroup', () => {
	it('should create group with multiple fields', () => {
		const group = new FormFieldGroup({
			name: new FormField('John'),
			age: new FormField(25),
		});

		const fields = group.getFields();
		expect(fields.name.getValue()).toBe('John');
		expect(fields.age.getValue()).toBe(25);
	});

	it('should validate all fields in group', () => {
		const nameValidator = (value: string) =>
			value.length > 0
				? right(value)
				: left({ message: 'Name required' });

		const ageValidator = (value: number) =>
			value >= 0
				? right(value)
				: left({ message: 'Age must be positive' });

		const group = new FormFieldGroup({
			name: new FormField('John', nameValidator),
			age: new FormField(25, ageValidator),
		});

		const result = group.validateGroup();
		expect(result.isRight()).toBe(true);
	});

	it('should fail validation if any field fails', () => {
		const nameValidator = (value: string) =>
			value.length > 0
				? right(value)
				: left({ message: 'Name required' });

		const group = new FormFieldGroup({
			name: new FormField('', nameValidator), // This will fail
			age: new FormField(25),
		});

		const result = group.validateGroup();
		expect(result.isLeft()).toBe(true);
	});
});

describe('Form', () => {
	it('should handle nested field access with paths', () => {
		const form = new Form({
			user: new FormFieldGroup({
				name: new FormField('John'),
				address: new FormFieldGroup({
					street: new FormField('123 Main St'),
					coordinates: new FormFieldGroup({
						lat: new FormField(40.7128),
						lng: new FormField(-74.006),
					}),
				}),
			}),
		});

		// Test path access
		expect(form.getValueByPath('user.name')).toBe('John');
		expect(form.getValueByPath('user.address.street')).toBe('123 Main St');
		expect(form.getValueByPath('user.address.coordinates.lat')).toBe(
			40.7128
		);
	});

	it('should update nested values correctly', () => {
		const form = new Form({
			user: new FormFieldGroup({
				name: new FormField('John'),
				address: new FormFieldGroup({
					street: new FormField('123 Main St'),
				}),
			}),
		});

		const updatedForm = form.setValueByPath(
			'user.address.street',
			'456 Oak Ave'
		);

		// Original form unchanged
		expect(form.getValueByPath('user.address.street')).toBe('123 Main St');

		// New form updated
		expect(updatedForm.getValueByPath('user.address.street')).toBe(
			'456 Oak Ave'
		);

		// Other values unchanged
		expect(updatedForm.getValueByPath('user.name')).toBe('John');
	});

	it('should validate entire form', () => {
		const emailValidator = (value: string) =>
			value.includes('@')
				? right(value)
				: left({ message: 'Invalid email' });

		const form = new Form({
			email: new FormField('test@example.com', emailValidator),
			profile: new FormFieldGroup({
				name: new FormField('John'),
			}),
		});

		const result = form.validateForm();
		expect(result.isRight()).toBe(true);
	});
});
