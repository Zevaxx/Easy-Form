import { test, expect, describe, vi, beforeEach } from 'vitest';
import { left, right } from '@sweet-monads/either';
import { Form, FormField, FormFieldGroup } from '../src/form/Form';

// Validators from README examples
const notEmpty = (value: string) =>
	value.length > 0
		? right(value)
		: left({ message: 'Field cannot be empty' });

const isAdult = (age: number) =>
	age >= 18 ? right(age) : left({ message: 'Must be 18 or older' });

const minLength = (min: number) => (value: string) =>
	value.length >= min
		? right(value)
		: left({ message: `Must be at least ${min} characters` });

const isValidEmail = (email: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
		? right(email)
		: left({ message: 'Invalid email format' });

const hasUppercase = (value: string) =>
	/[A-Z]/.test(value)
		? right(value)
		: left({ message: 'Must contain at least one uppercase letter' });

// Mock function for rate limiting
const getUserRecentSubmissions = vi.fn();

describe('README Basic Usage Examples', () => {
	test('simple user form creation and operations', () => {
		// Create a simple form
		const userForm = new Form({
			name: new FormField('John', notEmpty),
			age: new FormField(25, isAdult),
			email: new FormField('john@example.com'),
		});

		// Get values
		expect(userForm.getValueByPath('name')).toBe('John');
		expect(userForm.getValueByPath('age')).toBe(25);
		expect(userForm.getValueByPath('email')).toBe('john@example.com');

		// Update values
		const updatedForm = userForm.setValueByPath('name', 'Jane');
		expect(updatedForm.getValueByPath('name')).toBe('Jane');
		expect(userForm.getValueByPath('name')).toBe('John'); // Original unchanged

		// Validate the form
		const validationResult = updatedForm.validateForm();
		expect(validationResult.isRight()).toBe(true);
	});

	test('form validation with invalid data', () => {
		const userForm = new Form({
			name: new FormField('', notEmpty), // Invalid: empty
			age: new FormField(16, isAdult), // Invalid: under 18
			email: new FormField('john@example.com'),
		});

		const validationResult = userForm.validateForm();
		expect(validationResult.isLeft()).toBe(true);
		expect(
			validationResult.fold(
				(error) => error.message,
				() => 'Should not succeed'
			)
		).toBe('Field cannot be empty');
	});
});

describe('Group-Level Validation Examples', () => {
	test('password matching group validation', () => {
		// Group validator: both passwords must match
		const passwordsMatch = (group: {
			password: FormField<string>;
			confirmPassword: FormField<string>;
		}) => {
			const password = group.password.getValue();
			const confirmPassword = group.confirmPassword.getValue();

			return password === confirmPassword
				? right(group)
				: left({ message: 'Passwords must match' });
		};

		const registrationForm = new Form({
			username: new FormField('johndoe', notEmpty),
			security: new FormFieldGroup(
				{
					password: new FormField('SecurePass123', [
						notEmpty,
						minLength(8),
					]),
					confirmPassword: new FormField('SecurePass123', notEmpty),
				},
				passwordsMatch
			),
		});

		// Test matching passwords
		const validResult = registrationForm.validateForm();
		expect(validResult.isRight()).toBe(true);

		// Test non-matching passwords
		const mismatchForm = new Form({
			username: new FormField('johndoe', notEmpty),
			security: new FormFieldGroup(
				{
					password: new FormField('SecurePass123', [
						notEmpty,
						minLength(8),
					]),
					confirmPassword: new FormField('DifferentPass', notEmpty),
				},
				passwordsMatch
			),
		});

		const invalidResult = mismatchForm.validateForm();
		expect(invalidResult.isLeft()).toBe(true);
		expect(
			invalidResult.fold(
				(error) => error.message,
				() => {
					throw new Error('Expected validation to fail');
				}
			)
		).toBe('Passwords must match');
	});

	test('US address validation group', () => {
		// Address group validator: if country is US, zip code is required
		const validateUSAddress = (group: {
			street: FormField<string>;
			country: FormField<string>;
			zipCode: FormField<string>;
			city: FormField<string>;
		}) => {
			const country = group.country.getValue();
			const zipCode = group.zipCode.getValue();

			if (country === 'US' && zipCode.length === 0) {
				return left({
					message: 'ZIP code is required for US addresses',
				});
			}

			return right(group);
		};

		// Test US address without ZIP code (should fail)
		const usFormWithoutZip = new Form({
			address: new FormFieldGroup(
				{
					street: new FormField('123 Main St', notEmpty),
					city: new FormField('New York', notEmpty),
					country: new FormField('US'),
					zipCode: new FormField(''),
				},
				validateUSAddress
			),
		});

		const usResult = usFormWithoutZip.validateForm();
		expect(usResult.isLeft()).toBe(true);

		expect(
			usResult.fold(
				(error) => error.message,
				() => 'Should not succeed'
			)
		).toBe('ZIP code is required for US addresses');

		// Test US address with ZIP code (should pass)
		const usFormWithZip = new Form({
			address: new FormFieldGroup(
				{
					street: new FormField('123 Main St', notEmpty),
					city: new FormField('New York', notEmpty),
					country: new FormField('US'),
					zipCode: new FormField('10001'),
				},
				validateUSAddress
			),
		});

		const validUsResult = usFormWithZip.validateForm();
		expect(validUsResult.isRight()).toBe(true);

		// Test non-US address without ZIP code (should pass)
		const nonUsForm = new Form({
			address: new FormFieldGroup(
				{
					street: new FormField('123 Main St', notEmpty),
					city: new FormField('Toronto', notEmpty),
					country: new FormField('CA'),
					zipCode: new FormField(''),
				},
				validateUSAddress
			),
		});

		const nonUsResult = nonUsForm.validateForm();
		expect(nonUsResult.isRight()).toBe(true);
	});
});

describe('Form-Level Validation Examples', () => {
	beforeEach(() => {
		getUserRecentSubmissions.mockReturnValue(3); // Default to under limit
	});

	test('business rules validation - minor marketing restriction', () => {
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
				return left({
					message:
						'Users under 18 cannot receive marketing communications',
				});
			}

			// Business rule: Admins must have notifications enabled
			if (role === 'admin' && !preferences.notifications.getValue()) {
				return left({
					message: 'Administrators must have notifications enabled',
				});
			}

			return right(formData);
		};

		// Test minor with marketing enabled (should fail)
		const minorWithMarketing = new Form(
			{
				user: new FormFieldGroup({
					name: new FormField('Alice', notEmpty),
					age: new FormField(16),
					role: new FormField('user'),
				}),
				preferences: new FormFieldGroup({
					notifications: new FormField(true),
					marketing: new FormField(true), // This will cause validation to fail
				}),
			},
			validateBusinessRules
		);

		const minorResult = minorWithMarketing.validateForm();
		expect(minorResult.isLeft()).toBe(true);

		expect(
			minorResult.fold(
				(error) => error.message,
				() => {
					throw new Error('Expected validation to fail');
				}
			)
		).toBe('Users under 18 cannot receive marketing communications');

		// Test adult with marketing enabled (should pass)
		const adultWithMarketing = new Form(
			{
				user: new FormFieldGroup({
					name: new FormField('Bob', notEmpty),
					age: new FormField(25),
					role: new FormField('user'),
				}),
				preferences: new FormFieldGroup({
					notifications: new FormField(true),
					marketing: new FormField(true),
				}),
			},
			validateBusinessRules
		);

		const adultResult = adultWithMarketing.validateForm();
		expect(adultResult.isRight()).toBe(true);

		// Test admin without notifications (should fail)
		const adminWithoutNotifications = new Form(
			{
				user: new FormFieldGroup({
					name: new FormField('Charlie', notEmpty),
					age: new FormField(30),
					role: new FormField('admin'),
				}),
				preferences: new FormFieldGroup({
					notifications: new FormField(false), // Admin must have notifications
					marketing: new FormField(false),
				}),
			},
			validateBusinessRules
		);

		const adminResult = adminWithoutNotifications.validateForm();
		expect(adminResult.isLeft()).toBe(true);

		expect(
			adminResult.fold(
				(error) => error.message,
				() => {
					throw new Error('Expected validation to fail');
				}
			)
		).toBe('Administrators must have notifications enabled');
	});

	test('rate limiting form validation', () => {
		const checkSubmissionRate = (formData: any) => {
			const recentSubmissions = getUserRecentSubmissions();

			if (recentSubmissions > 5) {
				return left({
					message:
						'Too many submissions. Please wait before submitting again.',
				});
			}

			return right(formData);
		};

		const form = new Form(
			{
				user: new FormFieldGroup({
					name: new FormField('Test User', notEmpty),
					age: new FormField(25),
				}),
			},
			checkSubmissionRate
		);

		// Test under rate limit
		getUserRecentSubmissions.mockReturnValue(3);
		const validResult = form.validateForm();
		expect(validResult.isRight()).toBe(true);

		// Test over rate limit
		getUserRecentSubmissions.mockReturnValue(7);
		const rateLimitedResult = form.validateForm();
		expect(rateLimitedResult.isLeft()).toBe(true);
		expect(rateLimitedResult.value.message).toBe(
			'Too many submissions. Please wait before submitting again.'
		);
	});

	test('multiple form validators', () => {
		const validateBusinessRules = (formData: any) => right(formData);

		const checkRateLimit = (formData: any) => {
			const recentSubmissions = getUserRecentSubmissions();
			return recentSubmissions > 5
				? left({ message: 'Rate limit exceeded' })
				: right(formData);
		};

		const form = new Form(
			{
				name: new FormField('Test', notEmpty),
			},
			[validateBusinessRules, checkRateLimit]
		);

		// Test with rate limit exceeded (second validator should fail)
		getUserRecentSubmissions.mockReturnValue(10);
		const result = form.validateForm();
		expect(result.isLeft()).toBe(true);
		expect(result.value.message).toBe('Rate limit exceeded');
	});
});

describe('Advanced Nested Validation Examples', () => {
	test('complete profile validation', () => {
		// Group validator for contact info
		const validateContactGroup = (group: {
			email: FormField<string>;
			phone: FormField<string>;
		}) => {
			const email = group.email.getValue();
			const phone = group.phone.getValue();

			// At least one contact method is required
			if (!email && !phone) {
				return left({
					message: 'Either email or phone number is required',
				});
			}

			return right(group);
		};

		// Form validator for complete profile
		const validateCompleteProfile = (formData: any) => {
			const personal = formData.personal.getFields();
			const contact = formData.contact.getFields();

			const hasName =
				personal.firstName.getValue() && personal.lastName.getValue();
			const hasContact =
				contact.email.getValue() || contact.phone.getValue();

			if (!hasName || !hasContact) {
				return left({
					message:
						'Profile must have complete name and contact information',
				});
			}

			return right(formData);
		};

		// Test incomplete profile (missing names)
		const incompleteProfile = new Form(
			{
				personal: new FormFieldGroup({
					firstName: new FormField('', notEmpty),
					lastName: new FormField('', notEmpty),
					bio: new FormField('Short bio here', minLength(10)),
				}),
				contact: new FormFieldGroup(
					{
						email: new FormField('test@example.com', isValidEmail),
						phone: new FormField(''),
					},
					validateContactGroup
				),
				preferences: new FormFieldGroup({
					theme: new FormField('light'),
					language: new FormField('en'),
				}),
			},
			validateCompleteProfile
		);

		const incompleteResult = incompleteProfile.validateForm();
		expect(incompleteResult.isLeft()).toBe(true);
		// First validation failure should be from field validation (empty firstName)
		expect(incompleteResult.value.message).toBe('Field cannot be empty');

		// Test profile with missing contact info
		const noContactProfile = new Form(
			{
				personal: new FormFieldGroup({
					firstName: new FormField('John', notEmpty),
					lastName: new FormField('Doe', notEmpty),
					bio: new FormField(
						'This is a longer bio with enough characters',
						minLength(10)
					),
				}),
				contact: new FormFieldGroup(
					{
						email: new FormField(''),
						phone: new FormField(''),
					},
					validateContactGroup
				),
				preferences: new FormFieldGroup({
					theme: new FormField('light'),
					language: new FormField('en'),
				}),
			},
			validateCompleteProfile
		);

		const noContactResult = noContactProfile.validateForm();
		expect(noContactResult.isLeft()).toBe(true);
		expect(noContactResult.value.message).toBe(
			'Either email or phone number is required'
		);

		// Test complete valid profile
		const completeProfile = new Form(
			{
				personal: new FormFieldGroup({
					firstName: new FormField('John', notEmpty),
					lastName: new FormField('Doe', notEmpty),
					bio: new FormField(
						'This is a comprehensive bio with sufficient detail',
						minLength(10)
					),
				}),
				contact: new FormFieldGroup(
					{
						email: new FormField(
							'john.doe@example.com',
							isValidEmail
						),
						phone: new FormField('555-0123'),
					},
					validateContactGroup
				),
				preferences: new FormFieldGroup({
					theme: new FormField('light'),
					language: new FormField('en'),
				}),
			},
			validateCompleteProfile
		);

		const completeResult = completeProfile.validateForm();
		expect(completeResult.isRight()).toBe(true);
	});

	test('nested path operations with complex form', () => {
		const profileForm = new Form({
			personal: new FormFieldGroup({
				firstName: new FormField('', notEmpty),
				lastName: new FormField('', notEmpty),
				bio: new FormField('', minLength(10)),
			}),
			contact: new FormFieldGroup({
				email: new FormField('', isValidEmail),
				phone: new FormField(''),
			}),
			preferences: new FormFieldGroup({
				theme: new FormField('light'),
				language: new FormField('en'),
			}),
		});

		// Test nested updates as shown in README
		const updatedProfile = profileForm
			.setValueByPath('personal.firstName', 'John')
			.setValueByPath('personal.lastName', 'Doe')
			.setValueByPath('contact.email', 'john.doe@example.com')
			.setValueByPath('preferences.theme', 'dark');

		// Verify all updates
		expect(updatedProfile.getValueByPath('personal.firstName')).toBe(
			'John'
		);
		expect(updatedProfile.getValueByPath('personal.lastName')).toBe('Doe');
		expect(updatedProfile.getValueByPath('contact.email')).toBe(
			'john.doe@example.com'
		);
		expect(updatedProfile.getValueByPath('preferences.theme')).toBe('dark');

		// Verify original form is unchanged
		expect(profileForm.getValueByPath('personal.firstName')).toBe('');
		expect(profileForm.getValueByPath('preferences.theme')).toBe('light');
	});
});

describe('API Reference Examples', () => {
	test('FormField with different validator configurations', () => {
		// Single validator
		const nameField = new FormField('John', notEmpty);
		expect(nameField.getValue()).toBe('John');
		expect(nameField.validate().isRight()).toBe(true);

		// Multiple validators
		const passwordField = new FormField('SecurePass123', [
			notEmpty,
			minLength(8),
			hasUppercase,
		]);
		expect(passwordField.validate().isRight()).toBe(true);

		// Invalid password (no uppercase)
		const weakPassword = new FormField('securepass123', [
			notEmpty,
			minLength(8),
			hasUppercase,
		]);
		const weakResult = weakPassword.validate();
		expect(weakResult.isLeft()).toBe(true);
		('Must contain at least one uppercase letter');
		expect(
			weakResult.fold(
				(error) => error.message,
				() => 'Should not succeed'
			)
		).toBe('Must contain at least one uppercase letter');

		// No validators
		const optionalField = new FormField('default value');
		expect(optionalField.validate().isRight()).toBe(true);
	});

	test('FormFieldGroup API examples', () => {
		// Without group validation
		const basicGroup = new FormFieldGroup({
			name: new FormField('John'),
			age: new FormField(25),
		});

		expect(basicGroup.getFields().name.getValue()).toBe('John');
		expect(basicGroup.validateGroup().isRight()).toBe(true);

		// With group validation
		const passwordsMatch = (group: any) => {
			const pass1 = group.password.getValue();
			const pass2 = group.confirmPassword.getValue();
			return pass1 === pass2
				? right(group)
				: left({ message: 'Passwords must match' });
		};

		const passwordGroup = new FormFieldGroup(
			{
				password: new FormField('secret123'),
				confirmPassword: new FormField('secret123'),
			},
			passwordsMatch
		);

		expect(passwordGroup.validateGroup().isRight()).toBe(true);

		// Test with mismatched passwords
		const mismatchGroup = new FormFieldGroup(
			{
				password: new FormField('secret123'),
				confirmPassword: new FormField('different'),
			},
			passwordsMatch
		);

		const mismatchResult = mismatchGroup.validateGroup();
		expect(mismatchResult.isLeft()).toBe(true);
		expect(mismatchResult.value.message).toBe('Passwords must match');
	});

	test('Form API examples', () => {
		// Without form validation
		const simpleForm = new Form({
			name: new FormField('John'),
			age: new FormField(25),
		});

		expect(simpleForm.getForm().name.getValue()).toBe('John');
		expect(simpleForm.validateForm().isRight()).toBe(true);

		// With form validation
		const businessValidator = (formData: any) => {
			const age = formData.age.getValue();
			return age >= 18
				? right(formData)
				: left({ message: 'Must be adult' });
		};

		const businessForm = new Form(
			{
				name: new FormField('John'),
				age: new FormField(16),
			},
			businessValidator
		);

		const businessResult = businessForm.validateForm();
		expect(businessResult.isLeft()).toBe(true);
		expect(businessResult.value.message).toBe('Must be adult');
	});

	test('type-safe path operations', () => {
		const form = new Form({
			user: new FormFieldGroup({
				personal: new FormFieldGroup({
					name: new FormField('John'),
				}),
				contact: new FormFieldGroup({
					email: new FormField('john@example.com'),
				}),
			}),
			preferences: new FormFieldGroup({
				theme: new FormField('light'),
			}),
		});

		// Test deeply nested path access
		expect(form.getValueByPath('user.personal.name')).toBe('John');
		expect(form.getValueByPath('user.contact.email')).toBe(
			'john@example.com'
		);
		expect(form.getValueByPath('preferences.theme')).toBe('light');

		// Test chained updates
		const updated = form
			.setValueByPath('user.personal.name', 'Jane')
			.setValueByPath('preferences.theme', 'dark');

		expect(updated.getValueByPath('user.personal.name')).toBe('Jane');
		expect(updated.getValueByPath('preferences.theme')).toBe('dark');
		expect(updated.getValueByPath('user.contact.email')).toBe(
			'john@example.com'
		); // Unchanged
	});
});

describe('Error Handling Examples', () => {
	test('Either pattern usage', () => {
		const form = new Form({
			name: new FormField('', notEmpty),
			age: new FormField(16, isAdult),
		});

		const result = form.validateForm();

		if (result.isLeft()) {
			// Handle validation failure
			expect(result.value.message).toBe('Field cannot be empty');
			expect(typeof result.value.message).toBe('string');
		} else {
			// This shouldn't happen with invalid data
			expect(true).toBe(false);
		}

		// Test successful validation
		const validForm = new Form({
			name: new FormField('John', notEmpty),
			age: new FormField(25, isAdult),
		});

		const validResult = validForm.validateForm();
		expect(validResult.isRight()).toBe(true);

		if (validResult.isRight()) {
			expect(validResult.value.name.getValue()).toBe('John');
			expect(validResult.value.age.getValue()).toBe(25);
		}
	});

	test('invalid path handling', () => {
		const form = new Form({
			name: new FormField('John'),
			age: new FormField(25),
		});

		// Test invalid path access
		expect(() => {
			form.getValueByPath('invalid.path' as any);
		}).toThrow();

		expect(() => {
			form.setValueByPath('invalid.path' as any, 'value');
		}).toThrow();
	});
});
