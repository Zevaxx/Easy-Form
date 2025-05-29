import { expectTypeOf } from 'expect-type';
import { Form, FormField, FormFieldGroup } from '../src/form/Form';

// Test FormField type inference
const stringField = new FormField('hello');
expectTypeOf(stringField.getValue()).toEqualTypeOf<string>();

const numberField = new FormField(42);
expectTypeOf(numberField.getValue()).toEqualTypeOf<number>();

// Test FormFieldGroup type inference
const userGroup = new FormFieldGroup({
	name: new FormField('John'),
	age: new FormField(25),
	email: new FormField('john@example.com'),
});

const userFields = userGroup.getFields();
expectTypeOf(userFields.name).toEqualTypeOf<FormField<string>>();
expectTypeOf(userFields.age).toEqualTypeOf<FormField<number>>();
expectTypeOf(userFields.email).toEqualTypeOf<FormField<string>>();

// Test nested FormFieldGroup
const nestedForm = new Form({
	user: new FormFieldGroup({
		name: new FormField('John'),
		address: new FormFieldGroup({
			street: new FormField('123 Main St'),
			city: new FormField('New York'),
			coordinates: new FormFieldGroup({
				lat: new FormField(40.7128),
				lng: new FormField(-74.006),
			}),
		}),
	}),
	metadata: new FormField({ created: new Date(), version: 1 }),
});

// Test path type inference - estos deberían ser válidos
expectTypeOf(nestedForm.getValueByPath('user.name')).toEqualTypeOf<string>();
expectTypeOf(nestedForm.getValueByPath('user.address.street')).toEqualTypeOf<string>();
expectTypeOf(nestedForm.getValueByPath('user.address.city')).toEqualTypeOf<string>();
expectTypeOf(nestedForm.getValueByPath('user.address.coordinates.lat')).toEqualTypeOf<number>();
expectTypeOf(nestedForm.getValueByPath('user.address.coordinates.lng')).toEqualTypeOf<number>();
expectTypeOf(nestedForm.getValueByPath('metadata')).toEqualTypeOf<{ created: Date; version: number }>();

// Test que paths inválidos den error de tipo
// @ts-expect-error - Path 'user.nonexistent' should not exist
nestedForm.getValueByPath('user.nonexistent');

// @ts-expect-error - Path 'user.address.invalidField' should not exist
nestedForm.getValueByPath('user.address.invalidField');

// @ts-expect-error - Path 'nonexistent' should not exist
nestedForm.getValueByPath('nonexistent');

// @ts-expect-error - Path 'user.address.coordinates.invalid' should not exist
nestedForm.getValueByPath('user.address.coordinates.invalid');

// Test setValueByPath type safety
const updatedForm1 = nestedForm.setValueByPath('user.name', 'Jane');
expectTypeOf(updatedForm1).toEqualTypeOf<Form<typeof nestedForm.getForm()>>();

const updatedForm2 = nestedForm.setValueByPath('user.address.coordinates.lat', 41.8781);
expectTypeOf(updatedForm2).toEqualTypeOf<Form<typeof nestedForm.getForm()>>();

// Test que setValueByPath rechace tipos incorrectos
// @ts-expect-error - string expected, number given
nestedForm.setValueByPath('user.name', 123);

// @ts-expect-error - number expected, string given
nestedForm.setValueByPath('user.address.coordinates.lat', 'invalid');

// @ts-expect-error - object expected, string given
nestedForm.setValueByPath('metadata', 'invalid');

// Test setFieldValue para campos de primer nivel
const simpleForm = new Form({
	name: new FormField('John'),
	age: new FormField(25),
});

const updatedSimple = simpleForm.setValueByPath('name', 'Jane');
expectTypeOf(updatedSimple).toEqualTypeOf<Form<typeof simpleForm.getForm()>>();

// Test que setFieldValue rechace tipos incorrectos
// @ts-expect-error - string expected
simpleForm.setValueByPath('name', 123);

// @ts-expect-error - number expected
simpleForm.setValueByPath('age', 'invalid');

// Test validator types
import { Either } from '@sweet-monads/either';

const stringValidator = (value: string): Either<{ message: string }, string> =>
	({
		isRight: () => true,
		isLeft: () => false,
		value: value,
		chain: () => stringValidator(value),
		map: () => stringValidator(value),
	} as any);

const fieldWithValidator = new FormField('test', stringValidator);
expectTypeOf(fieldWithValidator.getValue()).toEqualTypeOf<string>();

// Test que validators con tipos incorrectos den error
// @ts-expect-error - validator should accept string, not number
new FormField('test', (value: number) => stringValidator(value.toString()));

// Test Path type generation and assignability
// Paths válidos que deberían ser permitidos
expectTypeOf<'user'>().toMatchTypeOf<string>();
expectTypeOf<'count'>().toMatchTypeOf<string>();
expectTypeOf<'user.name'>().toMatchTypeOf<string>();
expectTypeOf<'user.profile'>().toMatchTypeOf<string>();
expectTypeOf<'user.profile.bio'>().toMatchTypeOf<string>();
expectTypeOf<'user.profile.settings'>().toMatchTypeOf<string>();
expectTypeOf<'user.profile.settings.theme'>().toMatchTypeOf<string>();

// Alternative approach for testing path string literals
const validPaths = [
	'user',
	'count', 
	'user.name',
	'user.profile',
	'user.profile.bio',
	'user.profile.settings',
	'user.profile.settings.theme'
] as const;

validPaths.forEach(path => {
	expectTypeOf(path).toMatchTypeOf<string>();
});

