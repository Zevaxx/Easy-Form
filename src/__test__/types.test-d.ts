import { expectType, expectError, expectAssignable } from 'tsd';
import { Form, FormField, FormFieldGroup } from '../form/Form';

// Test FormField type inference
const stringField = new FormField('hello');
expectType<string>(stringField.getValue());

const numberField = new FormField(42);
expectType<number>(numberField.getValue());

// Test FormFieldGroup type inference
const userGroup = new FormFieldGroup({
	name: new FormField('John'),
	age: new FormField(25),
	email: new FormField('john@example.com'),
});

const userFields = userGroup.getFields();
expectType<FormField<string>>(userFields.name);
expectType<FormField<number>>(userFields.age);
expectType<FormField<string>>(userFields.email);

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
expectType<string>(nestedForm.getValueByPath('user.name'));
expectType<string>(nestedForm.getValueByPath('user.address.street'));
expectType<string>(nestedForm.getValueByPath('user.address.city'));
expectType<number>(nestedForm.getValueByPath('user.address.coordinates.lat'));
expectType<number>(nestedForm.getValueByPath('user.address.coordinates.lng'));
expectType<{ created: Date; version: number }>(
	nestedForm.getValueByPath('metadata')
);

// Test que paths inválidos den error de tipo
expectError(nestedForm.getValueByPath('user.nonexistent'));
expectError(nestedForm.getValueByPath('user.address.invalidField'));
expectError(nestedForm.getValueByPath('nonexistent'));
expectError(nestedForm.getValueByPath('user.address.coordinates.invalid'));

// Test setValueByPath type safety
const updatedForm1 = nestedForm.setValueByPath('user.name', 'Jane');

expectType<Form<typeof nestedForm.getForm()>>(updatedForm1);

const updatedForm2 = nestedForm.setValueByPath(
	'user.address.coordinates.lat',
	41.8781
);
expectType < Form < typeof nestedForm.getForm() >> updatedForm2;

// Test que setValueByPath rechace tipos incorrectos
expectError(nestedForm.setValueByPath('user.name', 123)); // string expected, number given
expectError(
	nestedForm.setValueByPath('user.address.coordinates.lat', 'invalid')
); // number expected, string given
expectError(nestedForm.setValueByPath('metadata', 'invalid')); // object expected, string given

// Test setFieldValue para campos de primer nivel
const simpleForm = new Form({
	name: new FormField('John'),
	age: new FormField(25),
});

const updatedSimple = simpleForm.setValueByPath('name', 'Jane');
expectType < Form < typeof simpleForm.getForm() >> updatedSimple;

// Test que setFieldValue rechace tipos incorrectos
expectError(simpleForm.setValueByPath('name', 123)); // string expected
expectError(simpleForm.setValueByPath('age', 'invalid')); // number expected

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
expectType<string>(fieldWithValidator.getValue());

// Test que validators con tipos incorrectos den error
expectError(
	new FormField('test', (value: number) => stringValidator(value.toString()))
);

// Test Path type generation
// type TestFormType = {
// 	user: FormFieldGroup<{
// 		name: FormField<string>;
// 		profile: FormFieldGroup<{
// 			bio: FormField<string>;
// 			settings: FormFieldGroup<{
// 				theme: FormField<string>;
// 			}>;
// 		}>;
// 	}>;
// 	count: FormField<number>;
// };

// Paths válidos que deberían ser permitidos
expectAssignable<'user'>('user' as const);
expectAssignable<'count'>('count' as const);
expectAssignable<'user.name'>('user.name' as const);
expectAssignable<'user.profile'>('user.profile' as const);
expectAssignable<'user.profile.bio'>('user.profile.bio' as const);
expectAssignable<'user.profile.settings'>('user.profile.settings' as const);
expectAssignable<'user.profile.settings.theme'>(
	'user.profile.settings.theme' as const
);
